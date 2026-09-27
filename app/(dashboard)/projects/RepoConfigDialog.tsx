'use client';

import * as React from 'react';
import { Select } from '@/components/ui/Select';
import { Input, Textarea } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { mutateJson, FetchError } from '@/lib/ui/swr';
import { toast } from '@/components/ui/Toast';
import {
  MAX_AUTHOR_PROFILES,
  MAX_CHUNKS,
  MIN_CHUNKS,
  PROFILE_OPTIONS,
  PROVIDER_OPTIONS,
  isProviderValue,
  isReviewProfile,
  splitLines,
  validateAuthorLogins,
  validateContextFiles,
  validateGuidelines,
  validateIgnorePatterns,
  validateMaxChunks,
} from './repo-config-options';
import styles from './RepoConfigDialog.module.css';

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
  customGuidelines: string;
  ignorePatterns: string[];
  contextFiles: string[];
  maxChunks: number;
};

type ReviewProfile = RepoConfig['reviewProfile'];

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

let authorRowSeq = 0;
function makeAuthorRow(login = '', profile: ReviewProfile = 'normal'): AuthorProfileRow {
  authorRowSeq += 1;
  return { id: `apr-${authorRowSeq}`, login, profile };
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
    customGuidelines: config.customGuidelines,
    ignorePatternsText: (config.ignorePatterns ?? []).join('\n'),
    contextFilesText: (config.contextFiles ?? []).join('\n'),
    maxChunks: config.maxChunks,
  };
}

function validateForm(form: FormState): string | null {
  const logins = form.authorProfiles.map((r) => r.login.trim()).filter(Boolean);
  return (
    validateIgnorePatterns(splitLines(form.ignorePatternsText)) ??
    validateContextFiles(splitLines(form.contextFilesText)) ??
    validateAuthorLogins(logins) ??
    validateGuidelines(form.customGuidelines) ??
    validateMaxChunks(form.maxChunks)
  );
}

function formToConfig(form: FormState): Partial<RepoConfig> {
  const ignorePatterns = splitLines(form.ignorePatternsText);
  const contextFiles = splitLines(form.contextFilesText);

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
    customGuidelines: form.customGuidelines,
    ignorePatterns,
    contextFiles,
    maxChunks: form.maxChunks,
  };
}

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

  const guidelineCount = form.customGuidelines.length;

  return (
    <div className={styles.form}>
      <Select
        label="AI provider"
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
        label="Review profile"
        value={form.reviewProfile}
        onChange={(e) => {
          const val = e.target.value;
          if (isReviewProfile(val)) set('reviewProfile', val);
        }}
        options={PROFILE_OPTIONS}
        disabled={saving}
      />

      <fieldset className={styles.group}>
        <div className={styles.groupHead}>
          <legend className="prr-label">Per-author overrides</legend>
          <code className={styles.count}>
            {form.authorProfiles.length}/{MAX_AUTHOR_PROFILES}
          </code>
        </div>
        <p className="prr-hint">
          Use the GitHub <strong>username</strong> (e.g. <code>aziz-yoco</code>) — not the display name or email.
          Authors not listed here use the review profile above.
        </p>

        {form.authorProfiles.map((row, index) => (
          <div key={row.id} className={styles.overrideRow}>
            <Input
              aria-label={`GitHub username for override ${index + 1}`}
              placeholder="github-username"
              value={row.login}
              onChange={(e) => {
                const login = e.target.value;
                set(
                  'authorProfiles',
                  form.authorProfiles.map((r) => (r.id === row.id ? { ...r, login } : r))
                );
              }}
              disabled={saving}
              containerClassName="prr-grow"
            />
            <Select
              aria-label={`Review profile for override ${index + 1}`}
              value={row.profile}
              onChange={(e) => {
                const val = e.target.value;
                if (!isReviewProfile(val)) return;
                set(
                  'authorProfiles',
                  form.authorProfiles.map((r) => (r.id === row.id ? { ...r, profile: val } : r))
                );
              }}
              options={PROFILE_OPTIONS}
              disabled={saving}
              containerClassName={styles.overrideProfile}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                set(
                  'authorProfiles',
                  form.authorProfiles.filter((r) => r.id !== row.id)
                )
              }
              disabled={saving}
              aria-label={`Remove override for ${row.login.trim() || `row ${index + 1}`}`}
            >
              <Icon name="x" />
            </Button>
          </div>
        ))}

        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => set('authorProfiles', [...form.authorProfiles, makeAuthorRow()])}
            disabled={saving || form.authorProfiles.length >= MAX_AUTHOR_PROFILES}
          >
            <Icon name="plus" size={14} />
            Add override
          </Button>
        </div>
      </fieldset>

      <Switch
        label="Auto verdict — post the verdict automatically after review"
        checked={form.autoVerdict}
        onCheckedChange={(checked) => set('autoVerdict', checked)}
        disabled={saving}
      />

      <div className={styles.group}>
        <Slider
          label="Max chunks"
          min={MIN_CHUNKS}
          max={MAX_CHUNKS}
          step={1}
          value={[form.maxChunks]}
          onValueChange={([v]) => {
            if (v !== undefined) set('maxChunks', v);
          }}
          disabled={saving}
        />
        <div className={styles.scale}>
          <span>{MIN_CHUNKS} — minimal</span>
          <span>{MAX_CHUNKS} — thorough</span>
        </div>
      </div>

      <Textarea
        id={`custom-guidelines-${repoId}`}
        label="Custom guidelines"
        hint={`${guidelineCount}/2000 characters`}
        error={guidelineCount > 2000 ? `${guidelineCount}/2000 characters. Shorten it to save.` : undefined}
        value={form.customGuidelines}
        onChange={(e) => set('customGuidelines', e.target.value)}
        disabled={saving}
        placeholder="Additional review guidelines for this repository…"
      />

      <Textarea
        id={`ignore-patterns-${repoId}`}
        label="Ignore patterns"
        hint="One per line, at most 50."
        value={form.ignorePatternsText}
        onChange={(e) => set('ignorePatternsText', e.target.value)}
        disabled={saving}
        className={styles.mono}
        minHeight={80}
        placeholder={'*.md\ndist/**\nnode_modules/**'}
      />

      <Textarea
        id={`context-files-${repoId}`}
        label="Context files"
        hint="One per line, at most 20."
        value={form.contextFilesText}
        onChange={(e) => set('contextFilesText', e.target.value)}
        disabled={saving}
        className={styles.mono}
        minHeight={80}
        placeholder={'ARCHITECTURE.md\ndocs/api.md'}
      />

      {validationError && (
        <p className="prr-error" role="alert">
          {validationError}
        </p>
      )}

      <div className="prr-dialog-actions">
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
}: RepoConfigDialogProps): React.ReactElement | null {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className={styles.dialog}
      title={
        <>
          Configure <code>{repoFullName}</code>
        </>
      }
      description="Adjust review settings. Leave provider/model empty to inherit global defaults."
    >
      {open && (
        <ConfigForm
          repoId={repoId}
          config={config}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}
