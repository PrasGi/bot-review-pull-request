export interface WebhookInstallation {
  id: number;
  account?: { id: number; login: string } | null;
}

export interface WebhookRepository {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
}

export interface WebhookUser {
  id: number;
  login: string;
}

export interface WebhookPullRequest {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  draft: boolean;
  user: WebhookUser;
  head: { sha: string; ref: string };
  base: { sha: string; ref: string };
}

export interface PullRequestEvent {
  action: string;
  installation?: WebhookInstallation;
  repository: WebhookRepository;
  pull_request: WebhookPullRequest;
  requested_reviewer?: WebhookUser | null;
}

export interface InstallationEvent {
  action: string;
  installation: WebhookInstallation;
  repositories?: { id: number; full_name: string }[];
}

export interface InstallationRepositoriesEvent {
  action: string;
  installation: WebhookInstallation;
  repository_selection: "all" | "selected";
  repositories_added?: { id: number; full_name: string }[];
  repositories_removed?: { id: number; full_name: string }[];
}

export interface GenericWebhookPayload {
  action?: string;
  installation?: WebhookInstallation;
  repository?: WebhookRepository;
}
