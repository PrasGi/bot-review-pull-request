# Setup Guide

Complete runbook to get the PR Reviewer bot running. Follow in order.

## Overview of what you need

| # | Thing | Where |
|---|---|---|
| 1 | MongoDB Atlas cluster | mongodb.com/cloud/atlas |
| 2 | Deployed URL (Vercel) | vercel.com |
| 3 | GitHub App | github.com developer settings |
| 4 | AI provider key (GLM) | z.ai |
| 5 | Two generated secrets | `openssl rand -base64 32` |

> Order note: the GitHub App needs a public webhook URL, so deploy to Vercel first
> (even empty), then register the App with that URL.

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster. Region: **Singapore (aws / ap-southeast-1)** (closest to Indonesia).
2. Database Access → add a user + password.
3. Network Access → allow `0.0.0.0/0` (Vercel serverless has dynamic IPs; TLS + strong password keep it safe).
4. Copy the connection string → this is `MONGODB_URI`.

---

## 2. Deploy to Vercel (first pass)

1. Import this repo into Vercel (Hobby plan).
2. Set the project **Function Region** to Singapore (`sin1`) to sit near Atlas.
3. Ensure **Fluid compute** is enabled (default for new projects) — gives 300s max duration on Hobby.
4. Deploy once to obtain your URL, e.g. `https://your-app.vercel.app`. This is `APP_URL`.

---

## 3. Register the GitHub App

GitHub → Settings → Developer settings → **GitHub Apps** → **New GitHub App**.

- **GitHub App name**: anything (e.g. `my-pr-reviewer`). Note the resulting **slug** → `GITHUB_APP_SLUG`.
- **Homepage URL**: your `APP_URL`.
- **Callback URL**: `https://your-app.vercel.app/api/github/callback`
- **Request user authorization (OAuth) during installation**: ✅ ON
- **Webhook**:
  - Active: ✅
  - URL: `https://your-app.vercel.app/api/webhook`
  - Secret: generate a random string → `GITHUB_WEBHOOK_SECRET`
- **Permissions → Repository**:
  - Pull requests: **Read & write**
  - Contents: **Read-only**
  - Metadata: **Read-only** (mandatory)
- **Subscribe to events**: `Pull request`, `Installation target`, `Installation repositories`
- **Where can this app be installed**: Any account (so both your accounts can install it).
- **Optional features → User-to-server token expiration**: ✅ ON (secure default: 8h tokens + 6mo refresh).

After creating:
- Note **App ID** → `GITHUB_APP_ID`.
- Note **Client ID** → `GITHUB_CLIENT_ID`.
- Generate a **client secret** → `GITHUB_CLIENT_SECRET`.

---

## 4. AI provider key

- GLM (default): sign up at https://z.ai/model-api, top up, create an API key → `GLM_API_KEY`.
- Optional others: `KIMI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.

---

## 5. Generate secrets

```bash
openssl rand -base64 32   # → TOKEN_ENCRYPTION_KEY
openssl rand -base64 32   # → SESSION_SECRET
```

---

## 6. Environment variables

Set these in Vercel → Project → Settings → Environment Variables (and in a local `.env` for development):

```
MONGODB_URI=...
MONGODB_DB_NAME=pr_reviewer
GITHUB_APP_ID=...
GITHUB_APP_SLUG=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_WEBHOOK_SECRET=...
TOKEN_ENCRYPTION_KEY=...
SESSION_SECRET=...
APP_URL=https://your-app.vercel.app
GLM_API_KEY=...
CRON_SECRET=...
```

> Generate `CRON_SECRET` with `openssl rand -base64 32`. It authorizes the daily
> usage-rollup cron (`/api/cron/rollup`). On Vercel Pro the platform sends it
> automatically; on Hobby, trigger the endpoint from any external scheduler with
> an `Authorization: Bearer <CRON_SECRET>` header.

---

## 7. Seed the database

Run once (locally, with the same env plus admin credentials):

```bash
SEED_ADMIN_EMAIL="you@example.com" \
SEED_ADMIN_PASSWORD="a-strong-password" \
pnpm seed
```

This creates: the admin login, the global settings singleton (default model `glm-4.7`),
the model pricing table, and the 4 review-profile prompt templates. It is idempotent —
re-running preserves existing provider keys, pricing, and templates.

---

## 8. Verify

- Visit `https://your-app.vercel.app/api/health` → should return `{ "status": "ok", "db": "connected" }`.
- Redeploy after setting env vars if you deployed before adding them.

---

## 9. Connect a GitHub account

Sign in to the dashboard (`/login`, using the seeded admin credentials), open
**Projects**, and click **Connect GitHub account**. Pick the account and
repositories in GitHub's native picker; the OAuth callback stores the connection.
Repeat for the second account.

CLI alternative (headless / scripted):

```bash
pnpm connect
```

It prints the install URL; open it, pick your account and repositories, and the OAuth
callback stores the connection.

---

## 10. Usage rollup cron

The daily cron at `/api/cron/rollup` (see `vercel.json`, `0 1 * * *`) aggregates
`ai_calls` into the permanent `usage_daily` collection so the AI Usage page
survives the 30-day `ai_calls` TTL purge. On Vercel Pro this runs automatically;
on Hobby, point an external scheduler at the endpoint with the `CRON_SECRET`
bearer header (see §6). No action needed beyond setting `CRON_SECRET`.
