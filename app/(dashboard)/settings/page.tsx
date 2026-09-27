'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { PageHeader, SectionHeading } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState } from '@/components/data/States';
import { ProviderKeyRow } from '@/components/projects/ProviderKeyRow';
import { fetcher, mutateJson, FetchError } from '@/lib/ui/swr';
import styles from './page.module.css';

type Provider = 'anthropic' | 'openai' | 'glm' | 'kimi';
type ReviewProfile = 'chill' | 'normal' | 'professional' | 'expert';

type ModelPricingRow = {
  provider: Provider;
  model: string;
  inputPerM: number;
  outputPerM: number;
  updatedAt?: string;
};

type SettingsData = {
  defaultProvider: Provider;
  defaultModel: string;
  defaultReviewProfile: ReviewProfile;
  dailyCostAlertUsd: number | null;
  providerKeysSet: Record<string, boolean>;
  modelPricing: ModelPricingRow[];
  reviewProfiles: string[];
};

type PatchBody = {
  defaultProvider?: Provider;
  defaultModel?: string;
  defaultReviewProfile?: ReviewProfile;
  dailyCostAlertUsd?: number | null;
  providerKeys?: Partial<Record<Provider, string>>;
  modelPricing?: { provider: Provider; model: string; inputPerM: number; outputPerM: number }[];
};

const SETTINGS_KEY = '/api/dashboard/settings';

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'glm', 'kimi'];

const PROVIDER_OPTIONS = PROVIDERS.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }));

const REVIEW_PROFILE_OPTIONS: { value: ReviewProfile; label: string }[] = [
  { value: 'chill', label: 'Chill' },
  { value: 'normal', label: 'Normal' },
  { value: 'professional', label: 'Professional' },
  { value: 'expert', label: 'Expert' },
];

const HEADER = <PageHeader title="Settings" description="Global defaults, provider keys, pricing and cost alerts." />;

function LoadingSkeleton(): React.ReactElement {
  return (
    <div role="status" aria-label="Loading settings" className={styles.page}>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <Skeleton style={{ height: 18, width: 160, marginBottom: 20 }} />
          <Skeleton style={{ height: 40, marginBottom: 16 }} />
          <Skeleton style={{ height: 40 }} />
        </Card>
      ))}
    </div>
  );
}

function DefaultsSection({
  data,
  onMutate,
}: {
  data: SettingsData;
  onMutate: () => void;
}): React.ReactElement {
  const [provider, setProvider] = React.useState<Provider>(data.defaultProvider);
  const [model, setModel] = React.useState(data.defaultModel);
  const [profile, setProfile] = React.useState<ReviewProfile>(data.defaultReviewProfile);
  const [saving, setSaving] = React.useState(false);

  const isDirty =
    provider !== data.defaultProvider ||
    model !== data.defaultModel ||
    profile !== data.defaultReviewProfile;

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const patch: PatchBody = {};
      if (provider !== data.defaultProvider) patch.defaultProvider = provider;
      if (model !== data.defaultModel) patch.defaultModel = model;
      if (profile !== data.defaultReviewProfile) patch.defaultReviewProfile = profile;
      await mutateJson(SETTINGS_KEY, 'PATCH', patch);
      toast.success('Saved');
      onMutate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <SectionHeading>Defaults</SectionHeading>
      <div className={styles.fields}>
        <Select
          label="Default provider"
          value={provider}
          options={PROVIDER_OPTIONS}
          onChange={(e) => setProvider(e.target.value as Provider)}
        />
        <Input
          label="Default model"
          type="text"
          required
          minLength={1}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <Select
          label="Default review profile"
          value={profile}
          options={REVIEW_PROFILE_OPTIONS}
          onChange={(e) => setProfile(e.target.value as ReviewProfile)}
        />
        <div className={styles.actions}>
          <Button
            variant="secondary"
            loading={saving}
            disabled={!isDirty}
            onClick={() => { void handleSave(); }}
          >
            Save defaults
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ProviderKey({
  provider,
  isSet,
  onSaved,
}: {
  provider: Provider;
  isSet: boolean;
  onSaved: () => void;
}): React.ReactElement {
  const [saving, setSaving] = React.useState(false);

  const handleSave = async (value: string): Promise<boolean> => {
    if (!value) return false;
    setSaving(true);
    try {
      await mutateJson(SETTINGS_KEY, 'PATCH', { providerKeys: { [provider]: value } });
      toast.success('Saved');
      onSaved();
      return true;
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : 'Failed to save key');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return <ProviderKeyRow provider={provider} isSet={isSet} saving={saving} onSave={handleSave} />;
}

function ProviderKeysSection({
  data,
  onMutate,
}: {
  data: SettingsData;
  onMutate: () => void;
}): React.ReactElement {
  return (
    <Card>
      <SectionHeading>Provider API keys</SectionHeading>
      <p className={`prr-hint ${styles.intro}`}>
        Keys are write-only and never returned. Enter a new value to replace an existing key.
      </p>
      <div>
        {PROVIDERS.map((p) => (
          <ProviderKey
            key={p}
            provider={p}
            isSet={data.providerKeysSet[p] === true}
            onSaved={onMutate}
          />
        ))}
      </div>
    </Card>
  );
}

type PricingRowLocal = {
  id: string;
  provider: Provider;
  model: string;
  inputPerM: string;
  outputPerM: string;
};

function toLocal(rows: ModelPricingRow[]): PricingRowLocal[] {
  return rows.map((r, i) => ({
    id: `${r.provider}-${r.model}-${i}`,
    provider: r.provider,
    model: r.model,
    inputPerM: String(r.inputPerM),
    outputPerM: String(r.outputPerM),
  }));
}

function toPayload(rows: PricingRowLocal[]): { provider: Provider; model: string; inputPerM: number; outputPerM: number }[] {
  return rows.map((r) => ({
    provider: r.provider,
    model: r.model,
    inputPerM: parseFloat(r.inputPerM) || 0,
    outputPerM: parseFloat(r.outputPerM) || 0,
  }));
}

function ModelPricingSection({
  data,
  onMutate,
}: {
  data: SettingsData;
  onMutate: () => void;
}): React.ReactElement {
  const [rows, setRows] = React.useState<PricingRowLocal[]>(() => toLocal(data.modelPricing));
  const [saving, setSaving] = React.useState(false);

  const updateRow = (id: string, field: keyof PricingRowLocal, value: string): void => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const addRow = (): void => {
    const newId = `new-${Date.now()}`;
    setRows((prev) => [
      ...prev,
      { id: newId, provider: 'anthropic', model: '', inputPerM: '0', outputPerM: '0' },
    ]);
  };

  const removeRow = (id: string): void => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await mutateJson(SETTINGS_KEY, 'PATCH', { modelPricing: toPayload(rows) });
      toast.success('Saved');
      onMutate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <SectionHeading>Model pricing</SectionHeading>
      <div className={styles.pricingScroll}>
        <table className={styles.pricing}>
          <thead>
            <tr>
              <th scope="col" className="prr-label">Provider</th>
              <th scope="col" className="prr-label">Model</th>
              <th scope="col" className={`prr-label ${styles.num}`}>Input / M tokens ($)</th>
              <th scope="col" className={`prr-label ${styles.num}`}>Output / M tokens ($)</th>
              <th scope="col">
                <span className="prr-sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Select
                    aria-label="Provider"
                    value={row.provider}
                    options={PROVIDER_OPTIONS}
                    onChange={(e) => updateRow(row.id, 'provider', e.target.value)}
                    containerClassName={styles.providerCell}
                  />
                </td>
                <td>
                  <Input
                    aria-label="Model name"
                    value={row.model}
                    onChange={(e) => updateRow(row.id, 'model', e.target.value)}
                    containerClassName={styles.modelCell}
                  />
                </td>
                <td>
                  <Input
                    aria-label="Input cost per million tokens"
                    type="number"
                    min={0}
                    step="any"
                    value={row.inputPerM}
                    onChange={(e) => updateRow(row.id, 'inputPerM', e.target.value)}
                    className={styles.numInput}
                    containerClassName={styles.priceCell}
                  />
                </td>
                <td>
                  <Input
                    aria-label="Output cost per million tokens"
                    type="number"
                    min={0}
                    step="any"
                    value={row.outputPerM}
                    onChange={(e) => updateRow(row.id, 'outputPerM', e.target.value)}
                    className={styles.numInput}
                    containerClassName={styles.priceCell}
                  />
                </td>
                <td>
                  <Button variant="ghost" size="icon" aria-label="Remove row" onClick={() => removeRow(row.id)}>
                    <Icon name="trash" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <EmptyState title="No pricing rows" description="Add a row to price a model." />}
      <div className={styles.footer}>
        <Button variant="ghost" size="sm" onClick={addRow}>
          <Icon name="plus" size={14} />
          Add row
        </Button>
        <Button variant="secondary" loading={saving} onClick={() => { void handleSave(); }}>
          Save pricing
        </Button>
      </div>
    </Card>
  );
}

function CostAlertsSection({
  data,
  onMutate,
}: {
  data: SettingsData;
  onMutate: () => void;
}): React.ReactElement {
  const [enabled, setEnabled] = React.useState(data.dailyCostAlertUsd !== null);
  const [amount, setAmount] = React.useState(
    data.dailyCostAlertUsd !== null ? String(data.dailyCostAlertUsd) : ''
  );
  const [saving, setSaving] = React.useState(false);

  const currentValue = enabled ? parseFloat(amount) || null : null;
  const isDirty = currentValue !== data.dailyCostAlertUsd;

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await mutateJson(SETTINGS_KEY, 'PATCH', { dailyCostAlertUsd: currentValue });
      toast.success('Saved');
      onMutate();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : 'Failed to save alert');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <SectionHeading>Cost alerts</SectionHeading>
      <div className={styles.fields}>
        <Switch
          id="enable-daily-alert"
          label="Enable daily cost alert"
          checked={enabled}
          onCheckedChange={(checked) => {
            setEnabled(checked);
            if (!checked) setAmount('');
          }}
        />
        {enabled && (
          <Input
            label="Daily limit (USD)"
            id="daily-cost-limit"
            type="number"
            min={0}
            step="0.01"
            placeholder="e.g. 10.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={styles.numInput}
          />
        )}
        <div className={styles.actions}>
          <Button
            variant="secondary"
            loading={saving}
            disabled={!isDirty}
            onClick={() => { void handleSave(); }}
          >
            Save alert
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function SettingsPage(): React.ReactElement {
  const { data, error, isLoading, mutate } = useSWR<SettingsData>(SETTINGS_KEY, fetcher);

  if (isLoading) {
    return (
      <div className={styles.page}>
        {HEADER}
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    const message = error instanceof FetchError ? error.message : 'Failed to load settings';
    return (
      <div className={styles.page}>
        {HEADER}
        <ErrorState title="Could not load settings" message={message} onRetry={() => void mutate()} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {HEADER}
      <DefaultsSection
        key={`${data.defaultProvider}|${data.defaultModel}|${data.defaultReviewProfile}`}
        data={data}
        onMutate={() => { void mutate(); }}
      />
      <ProviderKeysSection data={data} onMutate={() => { void mutate(); }} />
      <ModelPricingSection
        key={`pricing|${data.modelPricing.map((r) => `${r.provider}:${r.model}`).join(',')}`}
        data={data}
        onMutate={() => { void mutate(); }}
      />
      <CostAlertsSection
        key={`alert|${String(data.dailyCostAlertUsd)}`}
        data={data}
        onMutate={() => { void mutate(); }}
      />
    </div>
  );
}
