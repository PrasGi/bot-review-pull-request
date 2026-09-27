<div align="center">

# PR Reviewer

**A self-hosted AI bot that reviews GitHub pull requests as your own account, and tells you exactly what it did and didn't read.**

Webhook-driven · Multi-provider AI · Full audit trail · Honest about its limits

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb)
![License](https://img.shields.io/badge/license-private-lightgrey)

</div>

---

## What it is

Request a review from a connected GitHub user on a pull request. PR Reviewer fetches the diff, reviews it with an LLM, and posts a real GitHub review (**APPROVE**, **REQUEST_CHANGES** or **COMMENT**) with inline comments. The review is **attributed to that user's account**, so the pending review request is satisfied.

Every request, prompt, response, token and dollar is stored and browsable in an admin dashboard.

This README describes what the code does today. Every limit below comes from a constant in the source, and the [limitations](#limitations) are listed as plainly as the strengths.

---

## How it works

```
GitHub webhook ─▶ signature + dedupe + rate limit ─▶ trigger matrix ─▶ review_requests (queued)
                                                                               │  after()
                                                                               ▼
   posted review ◀─ verdict (decided by code) ◀─ scope guard ◀─ LLM chunks ◀─ diff filter + chunking
```

**What starts a review** (`lib/webhook/trigger-matrix.ts`):

| `pull_request` action | What happens |
|---|---|
| `review_requested` (a connected user is the reviewer) | Queued. A draft PR is recorded as `skipped_draft` instead |
| `ready_for_review` | Queued, only if that PR was skipped earlier as a draft |
| `synchronize` (new commits) | No new review. The running review gets a "new commits were pushed" note |
| `closed`, `review_request_removed` | Queued reviews are cancelled |
| anything else (`opened`, comments, team requests) | Ignored |

The bot never reviews by itself. Someone has to request a review from a connected user.

---

## Strengths

### It reviews the change, not the whole repo
- **A scope guard** (`lib/review/scope-guard.ts`) drops or downgrades findings the diff can't justify:
  - "undefined symbol" and "inconsistent with the rest of the codebase" findings are dropped
  - "missing auth or validation" is kept only if the diff removed it or your guidelines ask for it
  - speculative blocking findings are downgraded
  - A downgrade makes a finding non-blocking and prefixes it with "Please double-check…".
- **Named vulnerability classes always survive.** A finding that names open redirect, SQL, command or template injection, SSRF, path traversal, JWT or signature checks, timing attacks, hard-coded secrets and similar is never dropped. The guard has 17 tests, including a real "AuthGuard" incident.
- **Code decides the verdict**, not the model (`lib/review/verdict.ts`):
  - Any blocking finding → `REQUEST_CHANGES`.
  - Only non-blocking notes → `APPROVE` with a "double-check" caveat.
  - Auto-verdict off → always `COMMENT`.

### It is honest when it couldn't read everything
If files were left out (token budget), time ran out, or a chunk failed, the verdict is **forced to `COMMENT`**. The review body then states why and lists the skipped files. A partial read never approves or blocks code it didn't see.

### It fails loudly, not silently
- A failed review is **retried automatically once**, 60 seconds later.
- If the retry fails too, the bot posts **one** neutral comment on the PR saying the review could not be completed and asking for a re-request.
- The comment never includes internal error text, which can contain provider output.
- A runner and the stale-run reaper can't both post it (atomic `failureNotifiedAt`), and nothing is posted if a review already went out (`lib/review/failure.ts`).

### Re-reviews that respect your time
- **Delta only.** A re-review compares against the SHA of the last review and reads only what changed. It falls back to a full review after a force-push or diverged history (`lib/github/compare.ts`).
- **Reply-aware.** Reply to a finding instead of pushing code, then re-request. The bot classifies each finding as resolved, unresolved or not determinable. It acknowledges the resolved ones and recomputes the verdict, so it can flip to `APPROVE`.
- **Title and body changes** trigger a full review even without new commits.

### Tunable per repo and per author

| Profile | Max findings | Lowest severity reported |
|---|---|---|
| `chill` (default for new repos) | 5 | major |
| `normal` | 5 | major |
| `professional` | 25 | minor |
| `expert` | 40 | nit |

- **Per-author overrides:** up to 50, so one repo can review one author as `expert` and everyone else as `chill`.
- **Per repo you can set:**
  - provider and model
  - auto-verdict on or off
  - custom guidelines (≤ 2,000 chars)
  - ignore globs (≤ 50)
  - max chunks (1–84)

### Built for large PRs

| Limit | Value (`lib/review/pipeline.ts`) |
|---|---|
| Input budget per PR | 1,000,000 tokens |
| Chunk size | 12,000 tokens |
| Max chunks | 84 |
| Chunks in parallel | 4 |
| Per-call timeout | 10 min |
| No new retries after | 20 min |
| Whole-review deadline | 30 min |

- **Chunk order:** source code goes first, then other files, config and docs; within each group, larger files go first.
- **Oversized files:** a file bigger than a chunk keeps its first 60% and last 40%.
- **Always skipped:** lockfiles, generated or build output, binaries and minified files.

### Robust to bad model output
- The response schema is lenient: long fields are truncated, 0–100 confidence is normalized, and a malformed finding is dropped rather than failing the review.
- Invalid JSON gets **one repair call**.
- A response where *every* finding is malformed is rejected, so a garbled answer can't turn into a silent `APPROVE`.
- Findings are kept only on lines the PR added.
- If GitHub rejects the inline comments, the review is re-posted as summary-only instead of being lost.

### Multi-provider, with real cost tracking
- **GLM** (default) is supported, and so are **Kimi**, **OpenAI** and **Anthropic**. The provider is chosen globally, and a repo can override it.
- **API keys** come from the dashboard, encrypted at rest, or from env vars.
- **Every AI call is audited** in `ai_calls`: gzipped prompt and response, tokens, cost, latency and status. You can read the full prompt and response for any review in the dashboard.
- **Usage page:** cost and tokens by day, model or repo, with CSV export. A daily budget meter sits on the dashboard.

### Security built in
- **Encryption at rest:** GitHub access and refresh tokens and provider API keys are encrypted with AES-256-GCM (`lib/crypto.ts`).
- **Webhooks:** HMAC-SHA256 signature verification with a constant-time compare. Deliveries are deduplicated for 7 days, and each IP is rate limited.
- **Prompt injection:** PR content is wrapped as untrusted data, and injection attempts are reported as a security finding.
- **Admin login:** argon2 password hash, random session tokens stored only as SHA-256, `httpOnly` cookie, login rate limit, and an origin check on mutating API calls.
- **GitHub tokens:** expiring user tokens only. Refresh runs under a DB lock, and the account is flagged when it needs reconnecting.

### Multi-account and org friendly
- **Several accounts:** you can connect several GitHub accounts.
- **Org repos:** if you are only a member, the install becomes a pending request, and it syncs automatically once an owner approves it.
- **Health warnings:** the dashboard flags accounts that need reconnecting, tokens expiring within 14 days, repos with no webhook events for 7 days, and failures in the last 24 hours.

### A dashboard you can actually read
- **Pages:** Dashboard, Requests (live, refreshes every 5 s), request detail, AI Usage, Projects and Settings.
- **Design:** built on an in-house brutalist design system (`design-system/`, `components/`) with plain CSS Modules and hand-drawn SVG charts. There is no Tailwind, no Radix and no chart library.
- **Themes:** light and dark.

### Tested where it matters
There are **197 test cases in 28 files** (Vitest). They cover:
- the scope guard, verdict rules, schema salvage, chunking and the tokenizer
- summaries and replies
- the failure retry and comment path
- the webhook trigger matrix and signatures
- crypto and the retry utility

---

## Limitations

These are true of the current code. Some are deliberate trade-offs; others are gaps.

**Security and cost**
- **Open-install exposure.** `/api/github/connect` doesn't require an admin session, new repos are enabled by default, and the setup docs register the App for "Any account". So **any GitHub user who installs the App and completes OAuth can get reviews that spend your AI budget**.
  - Until this is gated, register the App for "Only on this account", or disable unknown repos in Projects.
- The default GLM endpoint is the **Coding Plan** endpoint, which is against its terms for this use (see `docs/setup.md`). Use the pay-as-you-go endpoint if that risk matters to you.
- The daily budget is **shown**, never **enforced**. There are no notifications (email or Slack) for budget alerts or failures, apart from the failure comment on the PR.

**Runtime and scale**
- **No durable queue.** Reviews run in-process via `after()`. If the process restarts mid-review, the reaper fails the run at the *next* webhook, and a restart during the 60-second retry wait loses that retry.
- **Single instance.** The webhook and login rate limits live in memory and trust `x-forwarded-for`.
- It is deployed on a VPS. On Vercel Hobby the 300-second function cap would kill long reviews. `docs/scaling.md` still describes the older Vercel setup.

**Review behavior**
- There is no auto-review on open or push, no `/review` comment command, and team review requests are ignored.
- **Findings on unchanged context lines are discarded**, even when they are correct.
- **Intent-match** (does the PR do what its description says) only works on single-chunk reviews.
- **Non-blocking findings** go into a collapsible section of the review body, not inline, so they can't be replied to or tracked as resolved.
- **Token counting is approximate**: `cl100k` plus per-provider multipliers, not each provider's own tokenizer.
- **Hard caps:**
  - 300 files per PR
  - 20 commit messages
  - PR body 1,000 chars in the prompt
  - 20 previous findings carried into a re-review
- **The scope guard is regex-based**, so it can downgrade a real finding, mostly on `chill` and `normal`.
- **Retry coverage is uneven.** PR fetch, file listing and review submit have no HTTP retry. Only installation and user lookups back off, and the whole run is retried once as described above.

**Stored but not used yet**
- **Context files** can be configured per repo but are not read by the pipeline.
- **The `usage_daily` rollup** is written but never read. The Usage page reads `ai_calls`, which expire after 30 days, so the 60- and 90-day views only show 30 days.
- **`stats` and `timings`** on review requests are never filled in, so those panels stay empty.
- **Queued follow-ups:** a review request that arrives while another is running only sets a flag, and no follow-up review is queued.
- **Default review profile:** the one in Settings isn't applied to new repos; new repos always start on `chill`.
- **Missing pricing:** Anthropic and OpenAI models have no seeded pricing, so their cost shows as $0 until you add rows in Settings.
- **Anthropic:** its client has no retries and ignores the reasoning setting.

---

## Tech stack

`Next.js 16` (App Router, Turbopack) · `React 19` · `TypeScript` · `MongoDB` (official driver) · `SWR` · `next-themes` · `zod` · argon2 · CSS Modules plus an in-house design system

**Production:** a VPS (PM2 and nginx), deployed by GitHub Actions on every push to `main`. See [`docs/deploy.md`](./docs/deploy.md).

---

## Setup

The full runbook is in **[`docs/setup.md`](./docs/setup.md)**. The essentials:

### 1. Register a GitHub App

**GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**:

| Field | Value |
|---|---|
| Callback URL | `https://<your-host>/api/github/callback` |
| Request user authorization (OAuth) during installation | **On**, so reviews post as the user |
| User-to-server token expiration | **On** (required: the app refuses non-expiring tokens) |
| Webhook URL | `https://<your-host>/api/webhook` |
| Webhook secret | a random string → `GITHUB_WEBHOOK_SECRET` |
| Permissions | Pull requests: read and write · Contents: read · Metadata: read |
| Events | Pull request, Installation target, Installation repositories |
| Where can this be installed | **Only on this account**, unless you need orgs (see [limitations](#limitations)) |

Then collect `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (shown once) and `GITHUB_WEBHOOK_SECRET`.

### 2. Environment

Set these as environment variables (names only; never commit real values):

| Group | Variables |
|---|---|
| Required | `MONGODB_URI`, `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`), `SESSION_SECRET` (≥ 32 chars) |
| GitHub | `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET` |
| Optional | `MONGODB_DB_NAME`, `APP_URL`, `CRON_SECRET`, `GLM_API_KEY`, `GLM_BASE_URL`, `KIMI_API_KEY`, `KIMI_BASE_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` |
| Seed only | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` |

### 3. Seed and verify

```bash
pnpm install
SEED_ADMIN_EMAIL="you@example.com" SEED_ADMIN_PASSWORD="a-strong-password" pnpm seed
curl https://<your-host>/api/health   # → {"status":"ok","db":"connected"}
```

`pnpm seed` creates the indexes, the admin login, the default settings (GLM, `glm-5.2`), model pricing and the four profile templates. You can run it again safely: it keeps existing keys, pricing and templates.

---

## Usage

1. **Connect an account.** Sign in at `/login`, then go to **Projects → Connect GitHub account** and pick the repos.
2. **Get a review.** On a PR in an enabled repo, **request review from the connected user** (not a team).
3. **Follow up.** Push a fix or reply to a finding, then **re-request review**. The bot reads only the delta, or your replies.
4. **If it fails.** It retries once by itself. If you then see "Automated review could not be completed" on the PR, check the request in the dashboard and use **Retry review**.

---

## Scripts

```bash
pnpm dev | build | start | lint | typecheck | test
pnpm seed                                      # indexes, admin, defaults, pricing (safe to re-run)
pnpm connect [--verify]                        # print the install URL / list connected users
pnpm set-profile <chill|normal|professional|expert>   # set the profile on all repos and the default
pnpm set-model <model> [--clear-overrides]     # set the default model (must have a pricing row)
pnpm set-chunks [n]                            # set maxChunks on all repos (1–84, default 84)
```

---

## More

- [`docs/setup.md`](./docs/setup.md): full setup runbook (MongoDB, GitHub App, GLM endpoints, cron, the org approval flow)
- [`docs/deploy.md`](./docs/deploy.md): how production is deployed (VPS, GitHub Actions, PM2, rollback)
- [`docs/scaling.md`](./docs/scaling.md): durability decisions and when to add a queue
- [`track-plans.md`](./track-plans.md): full system design and decision log
- [`design-system/`](./design-system/): the UI kit the dashboard is built from
