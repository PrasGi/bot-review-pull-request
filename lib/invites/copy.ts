import type { InactiveReason } from "@/lib/invites/summary";

// Every string shown by the owner-invite flow. Tests assert against these.

export const OPERATOR_NAME = "Prasetyo Putra Pratama";

export const INVITE_DIALOG_COPY = {
  trigger: "Invite org owner",
  title: "Invite an org owner",
  description:
    "Only an owner can install the app on an organization. Create a link, send it to them, and they finish the install on GitHub.",
  targetLabel: "Organization login",
  targetHint: "As it appears in the GitHub URL, e.g. github.com/YoCoApp.",
  reviewerLabel: "Reviewer account",
  reviewerHint: "The bot account that reviews pull requests in this org.",
  noReviewer:
    "Connect your GitHub account first. That account becomes the reviewer, and the invite links the org to it.",
  connect: "Connect GitHub account",
  create: "Create link",
  linkLabel: "Invite link",
  linkHint: (expires: string) =>
    `Single use. Expires ${expires}. It is shown only once, so copy it now.`,
  copy: "Copy link",
  copied: "Link copied.",
  copyFailed: "Could not copy. Select the link and copy it manually.",
  done: "Done",
  createFailed: "Could not create the invite link.",
} as const;

export const INVITE_LIST_COPY = {
  heading: "Owner invites",
  empty: "Links you create for org owners appear here with their status.",
  forTarget: (login: string) => `For ${login}`,
  expires: (date: string) => `Expires ${date}`,
  completed: (login: string, date: string) => `Connected ${login} on ${date}`,
  revoke: "Revoke",
  revoked: "Invite link revoked.",
  revokeFailed: "Could not revoke the invite link.",
  status: {
    open: "Open",
    completed: "Connected",
    revoked: "Revoked",
    expired: "Expired",
  },
} as const;

export const REVOKE_INVITE_COPY = {
  title: "Revoke invite link?",
  description: "The link you sent stops working. The owner will need a new one.",
  cancel: "Keep",
  confirm: "Revoke link",
} as const;

export const INVITE_PAGE_COPY = {
  metaTitle: "Connect your organization · PR Reviewer",
  kicker: "Installation invite",
  title: (org: string) => `Connect ${org} to PR Reviewer`,
  invitedBy: (login: string) =>
    `@${login} asked you to install PR Reviewer. You are receiving this because you own the organization.`,
  cta: "Continue to GitHub",
  ctaHint:
    "On GitHub, pick the repositories to review and save. You come back here to a confirmation.",
  sections: {
    what: {
      title: "What it does",
      body: [
        "PR Reviewer is an AI code reviewer that runs as a GitHub App.",
        "It reviews a pull request only when its reviewer account is requested on that pull request. It never reviews on its own.",
        "It posts inline comments and a verdict (APPROVE, REQUEST_CHANGES or COMMENT) as that reviewer account, so the review request is satisfied like any human review.",
      ],
    },
    permissions: {
      title: "Permissions it asks for",
      items: [
        { term: "Contents", value: "Read. To fetch the changed files of a pull request." },
        { term: "Metadata", value: "Read. Required by GitHub for every app; repository names and settings." },
        { term: "Pull requests", value: "Read and write. To read the diff and post the review." },
      ],
      note: "No write access to code, branches, issues, settings or members. It cannot merge or push.",
    },
    data: {
      title: "What is stored",
      body: [
        "The names of the repositories you select.",
        "For each review: the pull request number, the findings posted, token usage and cost.",
        "The prompt sent to the AI model (the diff plus the pull request title, description and commit messages) and the model's reply are kept for 30 days for auditing, then deleted.",
        "The diff goes to the configured AI provider to produce the review. Nothing else from the repository leaves GitHub.",
        "Your GitHub token is used once to confirm the installation, then revoked. It is never stored.",
      ],
    },
    remove: {
      title: "How to remove it",
      body: [
        "Deselect repositories, or uninstall the app, any time in your organization settings under GitHub Apps.",
        "Reviews stop immediately. Reviews already posted stay on the pull requests.",
      ],
    },
    operator: {
      title: "Who runs it",
      body: (name: string) =>
        `PR Reviewer is operated by ${name} for internal use. It is not a commercial service.`,
    },
  },
  states: {
    invalid: {
      badge: "✕ Invalid",
      title: "This invite link is not valid",
      body: "Check that the whole link was copied. Ask the person who sent it for a new one.",
    },
    revoked: {
      badge: "✕ Revoked",
      title: "This invite link was revoked",
      body: "Ask the person who sent it for a new one.",
    },
    expired: {
      badge: "! Expired",
      title: "This invite link has expired",
      body: "Invite links last 7 days. Ask the person who sent it for a new one.",
    },
    completed: {
      badge: "✓ Used",
      title: "This invite was already used",
      body: "The organization is connected.",
      link: "See the confirmation →",
    },
  },
} as const;

export const CONNECTED_PAGE_COPY = {
  metaTitle: "Connected · PR Reviewer",
  connected: {
    badge: "✓ Connected",
    title: (org: string) => `${org} is connected`,
    body: (date: string, active: number, total: number) =>
      `Installed on ${date}. Reviews are active on ${active} of ${total} ${total === 1 ? "repository" : "repositories"}.`,
  },
  waiting: {
    badge: "i Waiting",
    title: "Waiting for GitHub",
    body: "GitHub has not confirmed the installation yet. This page refreshes on its own.",
  },
  pending: {
    badge: "! Pending",
    title: "Approval pending",
    body: "GitHub sent a request instead of installing, which means the account used is not an owner. An owner of the organization has to approve it.",
  },
  error: {
    badge: "✕ Failed",
    title: "The installation could not be confirmed",
    body: "GitHub may still have saved it. Open the invite link again and continue to GitHub; the confirmation retries.",
    retry: "Back to the invite",
  },
  reposHeading: "Repositories",
  noRepos: {
    title: "No repositories selected",
    body: "Open the installation in your organization settings under GitHub Apps and select at least one.",
  },
  columns: {
    status: "Status",
    model: "Model",
    character: "Character",
  },
  active: "✓ Active",
  inactive: "✕ Not active",
  defaultModel: "default",
  noModel: "Not set",
  authorOverrides: "Per-author character",
  triggerHeading: "How to get a review",
  trigger: (login: string) =>
    `Open a pull request and request @${login} as a reviewer. The review posts within a few minutes.`,
  triggerUnknown: "Open a pull request and request the bot account as a reviewer.",
} as const;

export const INACTIVE_REASON_COPY: Record<InactiveReason, string> = {
  installation_inactive: "The installation is suspended or removed.",
  repo_disabled: "Reviews are turned off for this repository.",
  reviewer_missing: "The reviewer account is no longer connected.",
  reviewer_reconnect_required: "The reviewer account needs to reconnect.",
  reviewer_not_linked: "The reviewer account cannot see this installation yet.",
  no_model: "No AI model is configured.",
};
