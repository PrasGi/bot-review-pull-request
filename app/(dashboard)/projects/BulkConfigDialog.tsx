'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/components/ui/Toast';
import type { ReviewProfile } from '@/lib/db/types';
import { parseAuthorRules } from '@/lib/repos/author-rules';
import { BULK_CONFIRM_COPY, BULK_COPY as COPY, describeChanges } from '@/lib/repos/copy';
import type { RepoChanges } from '@/lib/repos/update';
import { FetchError, mutateJson } from '@/lib/ui/swr';
import {
  MAX_CHUNKS,
  MIN_CHUNKS,
  PROFILE_OPTIONS,
  PROVIDER_OPTIONS,
  isProviderValue,
  isReviewProfile,
  splitLines,
  validateGuidelines,
  validateIgnorePatterns,
} from './repo-config-options';
import styles from './BulkConfigDialog.module.css';

type Field = keyof typeof COPY.fields;

type FormState = {
  enabled: boolean;
  reviewProfile: ReviewProfile;
  provider: string;
  model: string;
  autoVerdict: boolean;
  maxChunks: number;
  customGuidelines: string;
  ignorePatternsText: string;
  authorProfilesText: string;
};

const INITIAL_FORM: FormState = {
  enabled: true,
  reviewProfile: 'chill',
  provider: '',
  model: '',
  autoVerdict: true,
  maxChunks: MAX_CHUNKS,
  customGuidelines: '',
  ignorePatternsText: '',
  authorProfilesText: '',
};

type BuildResult = { ok: true; changes: RepoChanges } | { ok: false; error: string };

function buildChanges(form: FormState, fields: Set<Field>): BuildResult {
  if (fields.size === 0) return { ok: false, error: COPY.nothing };
  const changes: RepoChanges = {};
  const config: NonNullable<RepoChanges['config']> = {};

  if (fields.has('enabled')) changes.enabled = form.enabled;
  if (fields.has('reviewProfile')) config.reviewProfile = form.reviewProfile;
  if (fields.has('model')) {
    // Provider and model move together: the default provider with a custom model is not a thing.
    const provider = isProviderValue(form.provider) ? form.provider : null;
    config.provider = provider;
    config.model = provider && form.model.trim() ? form.model.trim() : null;
  }
  if (fields.has('autoVerdict')) config.autoVerdict = form.autoVerdict;
  if (fields.has('maxChunks')) config.maxChunks = form.maxChunks;
  if (fields.has('customGuidelines')) {
    const err = validateGuidelines(form.customGuidelines);
    if (err) return { ok: false, error: err };
    config.customGuidelines = form.customGuidelines;
  }
  if (fields.has('ignorePatterns')) {
    const lines = splitLines(form.ignorePatternsText);
    const err = validateIgnorePatterns(lines);
    if (err) return { ok: false, error: err };
    config.ignorePatterns = lines;
  }
  if (fields.has('authorProfiles')) {
    const parsed = parseAuthorRules(form.authorProfilesText);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    config.authorProfiles = parsed.rules;
  }

  if (Object.keys(config).length > 0) changes.config = config;
  return { ok: true, changes };
}

type FieldBlockProps = {
  field: Field;
  checked: boolean;
  onCheckedChange: (field: Field, checked: boolean) => void;
  children: React.ReactNode;
};

function FieldBlock({ field, checked, onCheckedChange, children }: FieldBlockProps): React.ReactElement {
  return (
    <div className={styles.field} data-active={checked || undefined}>
      <Checkbox
        checked={checked}
        onChange={(e) => onCheckedChange(field, e.target.checked)}
        label={COPY.change(COPY.fields[field])}
      />
      {checked && <div className={styles.control}>{children}</div>}
    </div>
  );
}

type BulkConfigDialogProps = {
  ids: string[];
  onClose: () => void;
  onApplied: () => void;
};

/** Mounted only while open. Editing and confirming are two dialogs, never stacked. */
export function BulkConfigDialog({ ids, onClose, onApplied }: BulkConfigDialogProps): React.ReactElement {
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [fields, setFields] = React.useState<Set<Field>>(() => new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<RepoChanges | null>(null);
  const [saving, setSaving] = React.useState(false);
  const count = ids.length;

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const toggleField = (field: Field, checked: boolean): void => {
    setError(null);
    setFields((prev) => {
      const next = new Set(prev);
      if (checked) next.add(field);
      else next.delete(field);
      return next;
    });
  };

  const review = (): void => {
    const result = buildChanges(form, fields);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setPending(result.changes);
  };

  const apply = async (): Promise<void> => {
    if (!pending) return;
    setSaving(true);
    try {
      const res = await mutateJson<{ matched: number; modified: number }>('/api/dashboard/repos/bulk', 'PATCH', {
        ids,
        ...pending,
      });
      if (res.matched < count) toast.warning(COPY.partial(res.matched, count));
      else toast.success(COPY.applied(res.matched));
      onApplied();
      onClose();
    } catch (err) {
      toast.error(COPY.failed, err instanceof FetchError ? err.message : undefined);
      setSaving(false);
    }
  };

  const block = (field: Field, children: React.ReactNode): React.ReactElement => (
    <FieldBlock field={field} checked={fields.has(field)} onCheckedChange={toggleField}>
      {children}
    </FieldBlock>
  );

  return (
    <>
      <Dialog
        open={pending === null}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        className={styles.dialog}
        title={COPY.title(count)}
        description={COPY.description}
      >
        <div className={styles.form}>
          {block(
            'enabled',
            <Switch
              label={form.enabled ? 'Reviews on' : 'Reviews off'}
              checked={form.enabled}
              onCheckedChange={(checked) => set('enabled', checked)}
            />
          )}
          {block(
            'reviewProfile',
            <Select
              aria-label={COPY.fields.reviewProfile}
              value={form.reviewProfile}
              onValueChange={(v) => {
                if (isReviewProfile(v)) set('reviewProfile', v);
              }}
              options={PROFILE_OPTIONS}
            />
          )}
          {block(
            'model',
            <div className={styles.pair}>
              <Select
                label="AI provider"
                value={form.provider}
                onValueChange={(v) => set('provider', v)}
                options={PROVIDER_OPTIONS}
                containerClassName="prr-grow"
              />
              <Input
                label="Model"
                placeholder={form.provider ? 'Default — inherit global model' : 'Inherits the global model'}
                value={form.provider ? form.model : ''}
                onChange={(e) => set('model', e.target.value)}
                disabled={!form.provider}
                containerClassName="prr-grow"
              />
            </div>
          )}
          {block(
            'autoVerdict',
            <Switch
              label="Auto verdict — post the verdict automatically after review"
              checked={form.autoVerdict}
              onCheckedChange={(checked) => set('autoVerdict', checked)}
            />
          )}
          {block(
            'maxChunks',
            <Slider
              label={COPY.fields.maxChunks}
              min={MIN_CHUNKS}
              max={MAX_CHUNKS}
              step={1}
              value={[form.maxChunks]}
              onValueChange={([v]) => {
                if (v !== undefined) set('maxChunks', v);
              }}
            />
          )}
          {block(
            'customGuidelines',
            <Textarea
              aria-label={COPY.fields.customGuidelines}
              hint={`${form.customGuidelines.length}/2000 characters. Empty clears the guidelines.`}
              value={form.customGuidelines}
              onChange={(e) => set('customGuidelines', e.target.value)}
              placeholder="Additional review guidelines for these repositories…"
            />
          )}
          {block(
            'ignorePatterns',
            <Textarea
              aria-label={COPY.fields.ignorePatterns}
              hint="One per line, at most 50. Empty clears the list."
              value={form.ignorePatternsText}
              onChange={(e) => set('ignorePatternsText', e.target.value)}
              className={styles.mono}
              minHeight={80}
              placeholder={'*.md\ndist/**\nnode_modules/**'}
            />
          )}
          {block(
            'authorProfiles',
            <Textarea
              aria-label={COPY.fields.authorProfiles}
              hint={COPY.authorHint}
              value={form.authorProfilesText}
              onChange={(e) => set('authorProfilesText', e.target.value)}
              className={styles.mono}
              minHeight={80}
              placeholder={'aziz-yoco = chill\nsenior-dev = expert'}
            />
          )}

          {error && (
            <p className="prr-error" role="alert">
              {error}
            </p>
          )}

          <div className="prr-dialog-actions">
            <Button variant="secondary" onClick={onClose}>
              {COPY.cancel}
            </Button>
            <Button onClick={review} disabled={fields.size === 0}>
              {COPY.review}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          // Esc, backdrop and "Keep editing" all go back to the form without writing.
          if (!open && !saving) setPending(null);
        }}
        title={BULK_CONFIRM_COPY.title(count)}
        description={BULK_CONFIRM_COPY.description(pending ? describeChanges(pending) : [])}
        cancelLabel={BULK_CONFIRM_COPY.cancel}
        confirmLabel={BULK_CONFIRM_COPY.confirm(count)}
        onConfirm={() => void apply()}
        loading={saving}
      />
    </>
  );
}
