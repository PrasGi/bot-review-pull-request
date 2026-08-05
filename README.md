<div align="center">

# 🤖 PR Reviewer

**An AI-powered GitHub bot that reviews your pull requests — automatically, as your own account.**

Webhook-driven · Multi-provider AI · Multi-account/repo · Full audit dashboard

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss)
![License](https://img.shields.io/badge/license-private-lightgrey)

</div>

---

## ✨ Summary

Request a review on a GitHub PR → the bot fetches the diff, runs it through an LLM, and posts a real review (**APPROVE / REQUEST_CHANGES / COMMENT**) with inline comments — **attributed to your own GitHub account**, so the pending "requested reviewer" is satisfied. Every request, prompt, token, and cost is stored and browsable in an admin dashboard.

### What makes it different

| | |
|---|---|
| 🎭 **4 reviewer personalities** | `chill` · `normal` · `professional` · `expert` — per-repo, from lenient mentor to principal-level stickler |
| 🎯 **Scope discipline** | Reviews the *change*, not the whole repo — won't flag "missing auth guard" when it's wired globally outside the diff |
| 💬 **Reply-aware re-review** | Reply to a finding (no new commit) → the bot reads your rebuttal, re-evaluates, and can APPROVE if resolved |
| 🔁 **Smart re-reviews** | Delta-diff since last review, tracks resolved/unresolved findings, merge/rebase aware |
| 🧩 **Multi-provider AI** | GLM (default), Kimi, OpenAI, Anthropic — switchable per repo, exact token counting |
| 👥 **Multi-account / multi-org** | Connect several GitHub accounts; org repos supported (incl. member-request → owner-approval flow) |
| 📊 **Live dashboard** | Requests (auto-refresh 5s), AI usage & cost, per-repo config, connection health |
| 🔒 **Safe by design** | Silent on the PR when it fails · low-confidence caps verdict to COMMENT · encrypted tokens (AES-256-GCM) |

### Tech stack

`Next.js 16 (App Router)` · `React 19` · `TypeScript` · `MongoDB Atlas` · `Tailwind v4` · `Vercel (Hobby + Fluid compute)`

---

## 🚀 Installation

> **TL;DR:** deploy → register a GitHub App (grab tokens) → set env vars → seed DB → connect your GitHub account.
> Full runbook with every screenshot-level detail lives in **[`docs/setup.md`](./docs/setup.md)**. This section covers the essentials, especially **how to get the GitHub tokens**.

### Prerequisites

| Need | Where | Result |
|---|---|---|
| MongoDB cluster | [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas) (free M0) | `MONGODB_URI` |
| Hosting | [vercel.com](https://vercel.com) (Hobby + Fluid compute) | `APP_URL` |
| GitHub App | GitHub → Developer settings | 5 GitHub secrets (below) |
| AI key | [z.ai/model-api](https://z.ai/model-api) (GLM, default) — one key works on both endpoints, see [`docs/setup.md`](./docs/setup.md#which-glm-endpoint-glm_base_url) | `GLM_API_KEY` |
| `pnpm` + `openssl` | local machine | run scripts & generate secrets |

### Step 1 — Deploy first (empty is fine)

The GitHub App needs a **public webhook URL**, so deploy to Vercel once to get your `APP_URL` (e.g. `https://your-app.vercel.app`), then register the App against it.

### Step 2 — Register the GitHub App & get the tokens 🔑

This is the part people get stuck on. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App** and fill in:

<details>
<summary><b>📋 GitHub App settings (click to expand)</b></summary>

| Field | Value |
|---|---|
| **GitHub App name** | anything, e.g. `my-pr-reviewer` |
| **Homepage URL** | your `APP_URL` |
| **Callback URL** | `https://your-app.vercel.app/api/github/callback` |
| **Request user authorization (OAuth) during installation** | ✅ **ON** (this is what lets reviews post as *you*) |
| **Webhook → Active** | ✅ ON |
| **Webhook → URL** | `https://your-app.vercel.app/api/webhook` |
| **Webhook → Secret** | generate a random string → this is `GITHUB_WEBHOOK_SECRET` |
| **Permissions → Pull requests** | **Read & write** |
| **Permissions → Contents** | **Read-only** |
| **Permissions → Metadata** | **Read-only** (mandatory) |
| **Subscribe to events** | `Pull request`, `Installation target`, `Installation repositories` |
| **Where can this be installed** | Any account |
| **User-to-server token expiration** | ✅ ON (secure default: 8h token + 6-month refresh) |

</details>

**After clicking "Create GitHub App", collect these 5 values:**

| Token | Where to find it | Env var |
|---|---|---|
| **App ID** | top of the App's General page | `GITHUB_APP_ID` |
| **App slug** | the URL: `github.com/apps/`**`<slug>`** | `GITHUB_APP_SLUG` |
| **Client ID** | General page, under "Client ID" | `GITHUB_CLIENT_ID` |
| **Client secret** | click **"Generate a new client secret"** → copy immediately (shown once) | `GITHUB_CLIENT_SECRET` |
| **Webhook secret** | the random string you set above | `GITHUB_WEBHOOK_SECRET` |

> ⚠️ The **client secret** is shown **only once** — copy it right away. If you lose it, generate a new one (the old one keeps working until you delete it).

### Step 3 — Generate app secrets

```bash
openssl rand -base64 32   # → TOKEN_ENCRYPTION_KEY  (encrypts GitHub tokens at rest)
openssl rand -base64 32   # → SESSION_SECRET        (dashboard sessions)
openssl rand -base64 32   # → CRON_SECRET           (authorizes the usage-rollup cron)
```

### Step 4 — Set environment variables

In **Vercel → Project → Settings → Environment Variables** (and a local `.env` for dev):

```env
# Database
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=pr_reviewer

# GitHub App (from Step 2)
GITHUB_APP_ID=...
GITHUB_APP_SLUG=my-pr-reviewer
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_WEBHOOK_SECRET=...

# App secrets (from Step 3)
TOKEN_ENCRYPTION_KEY=...
SESSION_SECRET=...
CRON_SECRET=...

# Deployment
APP_URL=https://your-app.vercel.app

# AI provider (GLM is the default; others optional)
GLM_API_KEY=...
# KIMI_API_KEY=...
# ANTHROPIC_API_KEY=...
# OPENAI_API_KEY=...
```

### Step 5 — Seed the database (once)

Creates the admin login, global settings, model pricing, and the 4 review-profile templates. Idempotent.

```bash
pnpm install

SEED_ADMIN_EMAIL="you@example.com" \
SEED_ADMIN_PASSWORD="a-strong-password" \
pnpm seed
```

### Step 6 — Verify

```bash
curl https://your-app.vercel.app/api/health
# → { "status": "ok", "db": "connected" }
```

✅ **Installed.** Now connect your GitHub account (see Usage below).

---

## 📖 Usage

### 1. Connect a GitHub account

1. Open your app → **`/login`** → sign in with the seeded admin credentials.
2. Go to **Projects → "Connect GitHub account"**.
3. Pick the account + repositories in GitHub's native picker → done. Repos appear on the Projects page.

> **Org repos:** if you're only a *member* (not owner), the install becomes a **pending request** — an org owner approves it in GitHub, and the repos sync automatically. See [`docs/setup.md`](./docs/setup.md#organization-repos-owner-approval).

### 2. Get a PR reviewed

On any PR in a connected + enabled repo:

**Request review → pick the connected user** (e.g. `@your-github-user`, **not** a team) → the bot reviews within seconds and posts its verdict. That's it.

```
Author opens PR  →  requests review from @you  →  🤖 bot reviews & posts APPROVE / REQUEST_CHANGES / COMMENT
```

- ✏️ **Changed your mind after a finding?** Reply to the bot's comment explaining why → re-request review → the bot reads your reply and re-evaluates (can flip to APPROVE if your rebuttal holds).
- 🔁 **Pushed a fix?** Re-request review → the bot reviews only the delta since its last review.

### 3. Tune per repo

**Projects → Configure** on a repo lets you set:

| Setting | What it does |
|---|---|
| **Review profile** | `chill` (lenient mentor) → `expert` (principal-level strict) |
| **AI provider / model** | override the global default per repo |
| **Auto-verdict** | off = always COMMENT (never auto-approve/block) |
| **Confidence threshold** | low AI confidence → caps verdict to COMMENT |
| **Custom guidelines** | repo-specific rules injected into the prompt |
| **Ignore patterns** | globs to skip (on top of built-in lockfile/generated filters) |

### 4. Monitor

| Page | Shows |
|---|---|
| **Dashboard** | reviews/day, cost this month, verdict mix, "needs attention" alerts |
| **Requests** | every review request — author, repo, status, verdict, cost, duration (auto-refreshes every 5s) |
| **AI Usage** | cost & token breakdown by model/repo/day + CSV export |
| **Projects** | connected accounts, per-repo config, connection health |
| **Settings** | default provider/model, provider API keys, model pricing, cost alerts |

---

## 🧰 Scripts

```bash
pnpm dev            # local dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # vitest
pnpm seed           # seed admin + settings (idempotent)
pnpm connect        # CLI: print the GitHub install URL
pnpm set-profile <chill|normal|professional|expert>   # bulk-set review profile on all repos
pnpm set-model <model> [--clear-overrides]            # set the global default model (e.g. glm-5.2)
```

---

## 📚 More

- **[`docs/setup.md`](./docs/setup.md)** — full deployment runbook (MongoDB, Vercel, cron, org-approval flow)
- **[`docs/scaling.md`](./docs/scaling.md)** — durability decisions & when to scale beyond Vercel Hobby
- **`track-plans.md`** — the complete system design & architecture reference
