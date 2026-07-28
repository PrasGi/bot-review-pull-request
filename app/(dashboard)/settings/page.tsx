'use client';

import * as React from 'react';
import useSWR from 'swr';
import { Plus, Trash2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input, PasswordInput } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { fetcher, mutateJson, FetchError } from '@/lib/ui/swr';

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

function SectionHeading({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <h2 className="text-base font-semibold text-[var(--text)] mb-5">
      {children}
    </h2>
  );
}

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6">
      {[1, 2, 3, 4].map((i) => (
        <GlassCard key={i}>
          <Skeleton className="h-5 w-40 mb-5" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32 ml-auto" />
          </div>
        </GlassCard>
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
    <GlassCard>
      <SectionHeading>Defaults</SectionHeading>
      <div className="flex flex-col gap-4">
        <Select
          label="Default Provider"
          value={provider}
          options={PROVIDER_OPTIONS}
          onChange={(e) => setProvider(e.target.value as Provider)}
        />
        <Input
          label="Default Model"
          type="text"
          required
          minLength={1}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <Select
          label="Default Review Profile"
          value={profile}
          options={REVIEW_PROFILE_OPTIONS}
          onChange={(e) => setProfile(e.target.value as ReviewProfile)}
        />
        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            loading={saving}
            disabled={!isDirty}
            onClick={() => { void handleSave(); }}
          >
            Save defaults
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function ProviderKeyRow({
  provider,
  isSet,
  onSaved,
}: {
  provider: Provider;
  isSet: boolean;
  onSaved: () => void;
}): React.ReactElement {
  const [value, setValue] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const handleSave = async (): Promise<void> => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await mutateJson(SETTINGS_KEY, 'PATCH', {
        providerKeys: { [provider]: value.trim() },
      });
      toast.success('Saved');
      setValue('');
      onSaved();
    } catch (err) {
      toast.error(err instanceof FetchError ? err.message : 'Failed to save key');
    } finally {
      setSaving(false);
    }
  };

  const label = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-[var(--glass-border)] last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text)]">{label}</span>
        <Badge variant={isSet ? 'success' : 'neutral'}>
          {isSet ? 'Configured' : 'Not set'}
        </Badge>
      </div>
      <div className="flex gap-2">
        <PasswordInput
          aria-label={`${label} API key`}
          placeholder={isSet ? 'Enter new key to replace' : 'Enter API key'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          containerClassName="flex-1"
          disabled={saving}
        />
        <Button
          variant="secondary"
          loading={saving}
          disabled={!value.trim()}
          onClick={() => { void handleSave(); }}
          className="shrink-0"
        >
          Save key
        </Button>
      </div>
    </div>
  );
}

function ProviderKeysSection({
  data,
  onMutate,
}: {
  data: SettingsData;
  onMutate: () => void;
}): React.ReactElement {
  return (
    <GlassCard>
      <SectionHeading>Provider API Keys</SectionHeading>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Keys are write-only and never returned. Enter a new value to replace an existing key.
      </p>
      <div className="flex flex-col">
        {PROVIDERS.map((p) => (
          <ProviderKeyRow
            key={p}
            provider={p}
            isSet={data.providerKeysSet[p] === true}
            onSaved={onMutate}
          />
        ))}
      </div>
    </GlassCard>
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
    <GlassCard>
      <SectionHeading>Model Pricing</SectionHeading>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--text-muted)]">
              <th scope="col" className="pb-3 pr-3 font-medium text-xs">Provider</th>
              <th scope="col" className="pb-3 pr-3 font-medium text-xs">Model</th>
              <th scope="col" className="pb-3 pr-3 font-medium text-xs text-right">Input / M tokens ($)</th>
              <th scope="col" className="pb-3 pr-3 font-medium text-xs text-right">Output / M tokens ($)</th>
              <th scope="col" className="pb-3 font-medium text-xs sr-only">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="pr-3 pb-2">
                  <Select
                    aria-label="Provider"
                    value={row.provider}
                    options={PROVIDER_OPTIONS}
                    onChange={(e) => updateRow(row.id, 'provider', e.target.value)}
                    containerClassName="min-w-[110px]"
                  />
                </td>
                <td className="pr-3 pb-2">
                  <Input
                    aria-label="Model name"
                    value={row.model}
                    onChange={(e) => updateRow(row.id, 'model', e.target.value)}
                    containerClassName="min-w-[140px]"
                  />
                </td>
                <td className="pr-3 pb-2">
                  <Input
                    aria-label="Input cost per million tokens"
                    type="number"
                    min={0}
                    step="any"
                    value={row.inputPerM}
                    onChange={(e) => updateRow(row.id, 'inputPerM', e.target.value)}
                    className="text-right tabular-nums"
                    containerClassName="min-w-[110px]"
                  />
                </td>
                <td className="pr-3 pb-2">
                  <Input
                    aria-label="Output cost per million tokens"
                    type="number"
                    min={0}
                    step="any"
                    value={row.outputPerM}
                    onChange={(e) => updateRow(row.id, 'outputPerM', e.target.value)}
                    className="text-right tabular-nums"
                    containerClassName="min-w-[110px]"
                  />
                </td>
                <td className="pb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove row"
                    onClick={() => removeRow(row.id)}
                    className="mt-0"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          No pricing rows. Add one below.
        </p>
      )}
      <div className="flex items-center justify-between pt-3 mt-1 border-t border-[var(--glass-border)]">
        <Button variant="ghost" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add row
        </Button>
        <Button variant="primary" loading={saving} onClick={() => { void handleSave(); }}>
          Save pricing
        </Button>
      </div>
    </GlassCard>
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
    <GlassCard>
      <SectionHeading>Cost Alerts</SectionHeading>
      <div className="flex flex-col gap-4">
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
            className="tabular-nums"
          />
        )}
        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            loading={saving}
            disabled={!isDirty}
            onClick={() => { void handleSave(); }}
          >
            Save alert
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

export default function SettingsPage(): React.ReactElement {
  const { data, error, isLoading, mutate } = useSWR<SettingsData>(SETTINGS_KEY, fetcher);

  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-[var(--text)] mb-6">Settings</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    const message = error instanceof FetchError ? error.message : 'Failed to load settings';
    return (
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-[var(--text)] mb-6">Settings</h1>
        <GlassCard>
          <p className="text-sm text-[oklch(0.60_0.20_25)]" role="alert">
            {message}
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-[var(--text)] mb-6">Settings</h1>
      <div className="flex flex-col gap-6">
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
    </div>
  );
}
