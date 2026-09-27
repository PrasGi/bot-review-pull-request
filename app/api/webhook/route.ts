import { after, NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/github/webhook";
import { registerDelivery } from "@/lib/webhook/dedupe";
import { allowRequest, penalizeSignatureFailure } from "@/lib/webhook/ratelimit";
import {
  handleInstallationEvent,
  handleInstallationRepositoriesEvent,
  handleInstallationRequestEvent,
} from "@/lib/webhook/sync-events";
import { evaluatePullRequestEvent } from "@/lib/webhook/trigger-matrix";
import { reapStuckRequests } from "@/lib/review/reaper";
import { runReviewRequest } from "@/lib/review/runner";
import { handleRequestFailure } from "@/lib/review/failure";
import { completeOpenInvitesForAccount } from "@/lib/invites/complete";
import { errorFields, log } from "@/lib/logger";
import type {
  InstallationEvent,
  InstallationRepositoriesEvent,
  InstallationRequestEvent,
  PullRequestEvent,
} from "@/lib/webhook/payloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

// Fallback for owners who edit an existing installation: GitHub may not
// redirect them back, but it always sends the webhook. The reviewer resync
// makes GitHub calls, so it never holds the webhook response.
function completeInvitesLater(installation: InstallationEvent["installation"]): void {
  const accountLogin = installation.account?.login;
  if (!accountLogin) return;
  after(async () => {
    await completeOpenInvitesForAccount(accountLogin, installation.id).catch(
      (error: unknown) => {
        log.error("[invite] webhook completion failed", errorFields(error));
      },
    );
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = clientIp(request);
  if (!allowRequest(ip)) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    penalizeSignatureFailure(ip);
    return NextResponse.json({ status: "invalid_signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") ?? "unknown";
  const deliveryId = request.headers.get("x-github-delivery");
  if (!deliveryId) {
    return NextResponse.json({ status: "missing_delivery" }, { status: 400 });
  }

  const isNew = await registerDelivery(deliveryId, event);
  if (!isNew) {
    return NextResponse.json({ status: "duplicate" });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ status: "malformed_json" }, { status: 400 });
  }

  const reaped = await reapStuckRequests();
  if (reaped.length > 0) {
    // Retry-then-comment can wait a minute; never hold the webhook response for it.
    after(async () => {
      await Promise.all(reaped.map((id) => handleRequestFailure(id)));
    });
  }

  if (event === "installation") {
    const installationEvent = payload as InstallationEvent;
    await handleInstallationEvent(installationEvent);
    if (
      installationEvent.action !== "deleted" &&
      installationEvent.action !== "suspend"
    ) {
      completeInvitesLater(installationEvent.installation);
    }
    return NextResponse.json({ status: "synced" });
  }
  if (event === "installation_repositories") {
    const reposEvent = payload as InstallationRepositoriesEvent;
    await handleInstallationRepositoriesEvent(reposEvent);
    completeInvitesLater(reposEvent.installation);
    return NextResponse.json({ status: "synced" });
  }
  if (event === "installation_request") {
    await handleInstallationRequestEvent(payload as InstallationRequestEvent);
    return NextResponse.json({ status: "synced" });
  }

  if (event === "pull_request") {
    const outcome = await evaluatePullRequestEvent(
      payload as PullRequestEvent,
      deliveryId,
    );
    if (outcome.status === "queued") {
      const { requestId } = outcome;
      after(async () => {
        await runReviewRequest(requestId);
      });
    }
    return NextResponse.json(outcome);
  }

  return NextResponse.json({ status: "ignored", reason: `event:${event}` });
}
