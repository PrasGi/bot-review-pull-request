'use client';

import * as React from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { INVITE_DIALOG_COPY as COPY } from '@/lib/invites/copy';
import { FetchError, mutateJson } from '@/lib/ui/swr';
import styles from './InviteOrgDialog.module.css';

// Mirrors inviteCreateSchema.targetLogin in lib/schemas.
const GITHUB_LOGIN_RE = /^[A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38}$/;

type Reviewer = { id: string; githubLogin: string };

type CreatedInvite = { id: string; url: string; expiresAt: string };

type InviteOrgDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewers: Reviewer[];
  connectUrl: string;
  onCreated: () => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CopyField({ url, expiresAt }: CreatedInvite): React.ReactElement {
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(COPY.copied);
    } catch {
      toast.error(COPY.copyFailed);
    }
  };
  return (
    <div className={styles.copy}>
      <Input
        label={COPY.linkLabel}
        hint={COPY.linkHint(formatDate(expiresAt))}
        value={url}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
        className="prr-mono"
        containerClassName="prr-grow"
      />
      <Button variant="primary" onClick={() => void copy()} className={styles.copyButton}>
        <Icon name="link" size={14} />
        {COPY.copy}
      </Button>
    </div>
  );
}

export function InviteOrgDialog({ open, onOpenChange, reviewers, connectUrl, onCreated }: InviteOrgDialogProps): React.ReactElement {
  // The parent mounts this only while open, so every open starts from a clean form.
  const [targetLogin, setTargetLogin] = React.useState('');
  const [reviewerId, setReviewerId] = React.useState(reviewers[0]?.id ?? '');
  const [error, setError] = React.useState<string | undefined>();
  const [saving, setSaving] = React.useState(false);
  const [created, setCreated] = React.useState<CreatedInvite | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const login = targetLogin.trim();
    if (!GITHUB_LOGIN_RE.test(login)) {
      setError('Enter a valid GitHub organization login.');
      return;
    }
    setSaving(true);
    try {
      const invite = await mutateJson<CreatedInvite>('/api/dashboard/invites', 'POST', {
        targetLogin: login,
        reviewerConnectionId: reviewerId,
      });
      setCreated(invite);
      onCreated();
    } catch (err) {
      toast.error(COPY.createFailed, err instanceof FetchError ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={COPY.title} description={COPY.description}>
      {reviewers.length === 0 ? (
        <div className={styles.body}>
          <p className="prr-hint">{COPY.noReviewer}</p>
          <div className="prr-dialog-actions">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {COPY.done}
            </Button>
            <a href={connectUrl} className={buttonClass('primary')}>
              <Icon name="link" size={14} />
              {COPY.connect}
            </a>
          </div>
        </div>
      ) : created ? (
        <div className={styles.body}>
          <CopyField {...created} />
          <div className="prr-dialog-actions">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {COPY.done}
            </Button>
          </div>
        </div>
      ) : (
        <form className={styles.body} onSubmit={(e) => void submit(e)} noValidate>
          <Input
            label={COPY.targetLabel}
            hint={COPY.targetHint}
            placeholder="YoCoApp"
            value={targetLogin}
            onChange={(e) => {
              setTargetLogin(e.target.value);
              setError(undefined);
            }}
            error={error}
            autoComplete="off"
            spellCheck={false}
            disabled={saving}
          />
          {reviewers.length > 1 && (
            <Select
              label={COPY.reviewerLabel}
              hint={COPY.reviewerHint}
              value={reviewerId}
              onValueChange={setReviewerId}
              options={reviewers.map((r) => ({ value: r.id, label: `@${r.githubLogin}` }))}
              disabled={saving}
            />
          )}
          <div className="prr-dialog-actions">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {COPY.create}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
