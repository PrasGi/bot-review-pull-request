'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { mutateJson, FetchError } from '@/lib/ui/swr';
import { toast } from '@/components/ui/Toast';

export type AuthorProfileRule = {
  login: string;
  profile: 'chill' | 'normal' | 'professional' | 'expert';
};

export type RepoConfig = {
  provider: 'anthropic' | 'openai' | 'glm' | 'kimi' | null;
  model: string | null;
  reviewProfile: 'chill' | 'normal' | 'professional' | 'expert';
  authorProfiles?: AuthorProfileRule[];
  autoVerdict: boolean;
  confidenceThreshold: number;
  customGuidelines: string;
  ignorePatterns: string[];
  contextFiles: string[];
  maxChunks: number;
};

type ReviewProfile = RepoConfig['reviewProfile'];
type ProviderValue = Exclude<RepoConfig['provider'], null>;

type AuthorProfileRow = {
  id: string;
  login: string;
  profile: ReviewProfile;
};

type FormState = {
  provider: string;
  model: string;
  reviewProfile: ReviewProfile;
  authorProfiles: AuthorProfileRow[];
  autoVerdict: boolean;
  confidenceThreshold: number;
  customGuidelines: string;
  ignorePatternsText: string;
  contextFilesText: string;
  maxChunks: number;
};

export type RepoConfigDialogProps = {
  repoId: string;
  repoFullName: string;
  config: RepoConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default (inherit global)' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'glm', label: 'GLM' },
  { value: 'kimi', label: 'Kimi' },
];

const PROFILE_OPTIONS: { value: string; label: string }[] = [
  { value: 'chill', label: 'Chill — light-touch suggestions' },
  { value: 'normal', label: 'Normal — balanced feedback' },
  { value: 'professional', label: 'Professional — thorough review' },
  { value: 'expert', label: 'Expert — exhaustive analysis' },
];

const VALID_PROVIDERS: ProviderValue[] = ['anthropic', 'openai', 'glm', 'kimi'];
const VALID_PROFILES: ReviewProfile[] = ['chill', 'normal', 'professional', 'expert'];

const MAX_AUTHOR_PROFILES = 50;
// Mirrors authorProfileRuleSchema.login in lib/schemas: GitHub logins are
// alphanumeric with single non-trailing hyphens, 1–39 chars.
const GITHUB_LOGIN_RE = /^[A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38}$/;

let authorRowSeq = 0;
function makeAuthorRow(login = '', profile: ReviewProfile = 'normal'): AuthorProfileRow {
  authorRowSeq += 1;
  return { id: `apr-${authorRowSeq}`, login, profile };
}

function isProviderValue(v: string): v is ProviderValue {
  return (VALID_PROVIDERS as string[]).includes(v);
}

function isReviewProfile(v: string): v is ReviewProfile {
  return (VALID_PROFILES as string[]).includes(v);
}

function configToForm(config: RepoConfig): FormState {
  return {
    provider: config.provider ?? '',
    model: config.model ?? '',
    reviewProfile: config.reviewProfile,
    authorProfiles: (config.authorProfiles ?? []).map((r) =>
      makeAuthorRow(r.login, r.profile)
    ),
    autoVerdict: config.autoVerdict,
    confidenceThreshold: config.confidenceThreshold,
    customGuidelines: config.customGuidelines,
    ignorePatternsText: (config.ignorePatterns ?? []).join('\n'),
    contextFilesText: (config.contextFiles ?? []).join('\n'),
    maxChunks: config.maxChunks,
  };
}

function validateForm(form: FormState): string | null {
  const ignoreLines = form.ignorePatternsText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (ignoreLines.length > 50) return 'Ignore patterns: at most 50 entries allowed';
  const longIgnore = ignoreLines.find((l) => l.length > 200);
  if (longIgnore) return `Ignore pattern too long (max 200 chars): "${longIgnore.slice(0, 40)}…"`;

  const contextLines = form.contextFilesText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (contextLines.length > 20) return 'Context files: at most 20 entries allowed';
  const longContext = contextLines.find((l) => l.length > 300);
  if (longContext) return `Context file path too long (max 300 chars): "${longContext.slice(0, 40)}…"`;

  const authorRules = form.authorProfiles.filter((r) => r.login.trim() !== '');
  if (authorRules.length > MAX_AUTHOR_PROFILES)
    return `Author overrides: at most ${MAX_AUTHOR_PROFILES} entries allowed`;
  const badLogin = authorRules.find((r) => !GITHUB_LOGIN_RE.test(r.login.trim()));
  if (badLogin)
    return `Invalid GitHub username: "${badLogin.login.trim().slice(0, 40)}"`;

  if (form.customGuidelines.length > 2000)
    return 'Custom guidelines must be at most 2000 characters';
  if (form.confidenceThreshold < 0.3 || form.confidenceThreshold > 0.9)
    return 'Confidence threshold must be between 0.30 and 0.90';
  if (form.maxChunks < 1 || form.maxChunks > 8)
    return 'Max chunks must be between 1 and 8';

  return null;
}

function formToConfig(form: FormState): Partial<RepoConfig> {
  const ignorePatterns = form.ignorePatternsText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const contextFiles = form.contextFilesText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const authorProfiles: AuthorProfileRule[] = form.authorProfiles
    .map((r) => ({ login: r.login.trim(), profile: r.profile }))
    .filter((r) => r.login !== '');

  const provider: RepoConfig['provider'] =
    isProviderValue(form.provider) ? form.provider : null;

  return {
    provider,
    model: form.model.trim() === '' ? null : form.model.trim(),
    reviewProfile: form.reviewProfile,
    authorProfiles,
    autoVerdict: form.autoVerdict,
    confidenceThreshold: form.confidenceThreshold,
    customGuidelines: form.customGuidelines,
    ignorePatterns,
    contextFiles,
    maxChunks: form.maxChunks,
  };
}

const textareaClass = cn(
  'glass-btn w-full px-3 py-2 text-sm text-[var(--text)] resize-none rounded-[var(--radius-btn)]',
  'placeholder:text-[var(--text-muted)]',
  'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-0',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'transition-shadow'
);

type ConfigFormProps = {
  repoId: string;
  config: RepoConfig;
  onClose: () => void;
  onSaved: () => void;
};

function ConfigForm({ repoId, config, onClose, onSaved }: ConfigFormProps): React.ReactElement {
  const [form, setForm] = React.useState<FormState>(() => configToForm(config));
  const [saving, setSaving] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleSave = async (): Promise<void> => {
    const err = validateForm(form);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setSaving(true);
    try {
      await mutateJson(`/api/dashboard/repos/${repoId}`, 'PATCH', {
        config: formToConfig(form),
      });
      toast.success('Configuration saved');
      onSaved();
      onClose();
    } catch (e) {
      const message =
        e instanceof FetchError ? e.message : 'Failed to save configuration';
      toast.error('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 mt-2">
      <Select
        label="AI Provider"
        value={form.provider}
        onChange={(e) => set('provider', e.target.value)}
        options={PROVIDER_OPTIONS}
        disabled={saving}
      />

      <Input
        label="Model"
        placeholder="Default — inherit global model"
        value={form.model}
        onChange={(e) => set('model', e.target.value)}
        disabled={saving}
      />

      <Select
        label="Review Profile"
        value={form.reviewProfile}
        onChange={(e) => {
          const val = e.target.value;
          if (isReviewProfile(val)) set('reviewProfile', val);
        }}
        options={PROFILE_OPTIONS}
        disabled={saving}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text)]">
            Per-author Overrides
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {form.authorProfiles.length}/{MAX_AUTHOR_PROFILES}
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Use the GitHub <strong>username</strong> (e.g. <code>aziz-yoco</code>) — not the
          display name or email. Authors not listed here use the review profile above.
        </p>

        {form.authorProfiles.length > 0 && (
          <div className="flex flex-col gap-2">
            {form.authorProfiles.map((row, index) => (
              <div key={row.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    aria-label={`GitHub username for override ${index + 1}`}
                    placeholder="github-username"
                    value={row.login}
                    onChange={(e) => {
                      const login = e.target.value;
                      set(
                        'authorProfiles',
                        form.authorProfiles.map((r) =>
                          r.id === row.id ? { ...r, login } : r
                        )
                      );
                    }}
                    disabled={saving}
                  />
                </div>
                <div className="w-[13rem] shrink-0">
                  <Select
                    aria-label={`Review profile for override ${index + 1}`}
                    value={row.profile}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!isReviewProfile(val)) return;
                      set(
                        'authorProfiles',
                        form.authorProfiles.map((r) =>
                          r.id === row.id ? { ...r, profile: val } : r
                        )
                      );
                    }}
                    options={PROFILE_OPTIONS}
                    disabled={saving}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    set(
                      'authorProfiles',
                      form.authorProfiles.filter((r) => r.id !== row.id)
                    )
                  }
                  disabled={saving}
                  aria-label={`Remove override for ${row.login.trim() || `row ${index + 1}`}`}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        <div>
          <Button
            variant="secondary"
            onClick={() =>
              set('authorProfiles', [...form.authorProfiles, makeAuthorRow()])
            }
            disabled={saving || form.authorProfiles.length >= MAX_AUTHOR_PROFILES}
          >
            Add override
          </Button>
        </div>
      </div>

      <Switch
        label="Auto Verdict — post verdict automatically after review"
        checked={form.autoVerdict}
        onCheckedChange={(checked) => set('autoVerdict', checked)}
        disabled={saving}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text)]">Confidence Threshold</span>
          <span className="text-sm tabular-nums text-[var(--accent)] font-medium">
            {form.confidenceThreshold.toFixed(2)}
          </span>
        </div>
        <Slider
          min={0.3}
          max={0.9}
          step={0.05}
          value={[form.confidenceThreshold]}
          onValueChange={([v]) => {
            if (v !== undefined) set('confidenceThreshold', v);
          }}
          disabled={saving}
          aria-label="Confidence threshold"
        />
        <div className="flex justify-between text-xs text-[var(--text-muted)]">
          <span>0.30 — lenient</span>
          <span>0.90 — strict</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text)]">Max Chunks</span>
          <span className="text-sm tabular-nums text-[var(--accent)] font-medium">
            {form.maxChunks}
          </span>
        </div>
        <Slider
          min={1}
          max={8}
          step={1}
          value={[form.maxChunks]}
          onValueChange={([v]) => {
            if (v !== undefined) set('maxChunks', v);
          }}
          disabled={saving}
          aria-label="Max chunks"
        />
        <div className="flex justify-between text-xs text-[var(--text-muted)]">
          <span>1 — minimal</span>
          <span>8 — thorough</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`custom-guidelines-${repoId}`}
            className="text-sm font-medium text-[var(--text)]"
          >
            Custom Guidelines
          </label>
          <span
            className={cn(
              'text-xs tabular-nums',
              form.customGuidelines.length > 1800
                ? 'text-[oklch(0.60_0.20_25)]'
                : 'text-[var(--text-muted)]'
            )}
          >
            {form.customGuidelines.length}/2000
          </span>
        </div>
        <textarea
          id={`custom-guidelines-${repoId}`}
          rows={4}
          value={form.customGuidelines}
          onChange={(e) => set('customGuidelines', e.target.value)}
          disabled={saving}
          className={textareaClass}
          placeholder="Additional review guidelines for this repository…"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`ignore-patterns-${repoId}`}
            className="text-sm font-medium text-[var(--text)]"
          >
            Ignore Patterns
          </label>
          <span className="text-xs text-[var(--text-muted)]">one per line · max 50</span>
        </div>
        <textarea
          id={`ignore-patterns-${repoId}`}
          rows={3}
          value={form.ignorePatternsText}
          onChange={(e) => set('ignorePatternsText', e.target.value)}
          disabled={saving}
          className={cn(textareaClass, 'font-mono text-xs')}
          placeholder={'*.md\ndist/**\nnode_modules/**'}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`context-files-${repoId}`}
            className="text-sm font-medium text-[var(--text)]"
          >
            Context Files
          </label>
          <span className="text-xs text-[var(--text-muted)]">one per line · max 20</span>
        </div>
        <textarea
          id={`context-files-${repoId}`}
          rows={3}
          value={form.contextFilesText}
          onChange={(e) => set('contextFilesText', e.target.value)}
          disabled={saving}
          className={cn(textareaClass, 'font-mono text-xs')}
          placeholder={'ARCHITECTURE.md\ndocs/api.md'}
        />
      </div>

      {validationError && (
        <p className="text-sm text-[oklch(0.60_0.20_25)]" role="alert">
          {validationError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-[var(--glass-border)]">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

export function RepoConfigDialog({
  repoId,
  repoFullName,
  config,
  open,
  onOpenChange,
  onSaved,
}: RepoConfigDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {repoFullName}</DialogTitle>
          <DialogDescription>
            Adjust review settings. Leave provider/model empty to inherit global defaults.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ConfigForm
            repoId={repoId}
            config={config}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
