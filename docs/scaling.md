# Scaling & Durability Decisions

> Phase 6 hardening decision record. Revisit when a trigger below fires.

## Current architecture

The review pipeline runs inside the webhook invocation via Next.js `after()`
(`maxDuration = 300` on Vercel Hobby + Fluid compute). A stuck-job reaper
(`lib/review/reaper.ts`, 5-minute stale-heartbeat threshold) self-heals runs
killed by deploys, OOM, or the 300s cap. Retry/backoff for transient GitHub/AI
failures is handled in-process (`lib/util/retry.ts`).

## Decision: stay on Hobby + `after()` + reaper

At the current scale (2 GitHub accounts x ~3 repos, ~20-50 PRs/day peak, p95
pipeline ~83s measured), a durable queue (Inngest/QStash) or Vercel Pro is not
justified. The reaper covers the only realistic failure mode, and adding a queue
now is complexity for zero user-visible gain.

## Revisit triggers

Introduce a durable queue and/or upgrade to Vercel Pro when ONE of these fires:

1. **Reaper activations > 5/week** sustained for 2 weeks — real infra
   instability, not one-off cold-start kills.
2. **p95 pipeline duration > 240s** over a 7-day window — within 20% of the
   300s cliff.
3. **Concurrent active PRs regularly > 3** — provider rate-limit saturation and
   loss of queue-depth visibility.
4. **A 3rd account or 6th repo is added** — natural scale-doubling checkpoint.
5. **Provider 5xx rate > 2% of runs** — resumable state starts to matter.

## Escalation path (when a trigger fires)

Minimal path: **QStash + existing pipeline**. Webhook publishes to QStash (dedup
key = PR head SHA); QStash calls a new `/api/pipeline/run` endpoint that executes
the existing pipeline. Gains automatic retries with backoff, dedup, and
visibility. Defer Inngest/step-functions until resumable multi-step state is
genuinely needed. Vercel Pro ($20/mo, 800s maxDuration + better observability) is
worth it the moment trigger #2 fires.

## Observability

- Reaper activation count is derivable from `review_requests` where
  `error.stage = "timeout"`. Track this weekly against trigger #1.
- Structured logs (`lib/logger.ts`) emit `review.pipeline.start/completed/failed`
  with `durationMs` — feed trigger #2.
