'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { REPO_FILTER_COPY as COPY } from '@/lib/repos/copy';
import type { FilterOption, RepoFilter } from '@/lib/repos/filter';
import styles from './page.module.css';

type RepoFiltersProps = {
  filter: RepoFilter;
  options: { accounts: FilterOption[]; models: FilterOption[]; profiles: FilterOption[] };
  onChange: (updates: Partial<Record<keyof RepoFilter, string>>) => void;
  onClear: () => void;
  canClear: boolean;
};

const withAny = (options: FilterOption[]): FilterOption[] => [{ value: '', label: COPY.any }, ...options];

const STATUS_OPTIONS = withAny([
  { value: 'enabled', label: COPY.statuses.enabled },
  { value: 'disabled', label: COPY.statuses.disabled },
  { value: 'removed', label: COPY.statuses.removed },
]);

export function RepoFilters({ filter, options, onChange, onClear, canClear }: RepoFiltersProps): React.ReactElement {
  return (
    <div className={styles.filters}>
      <Select
        label={COPY.account}
        value={filter.account}
        onValueChange={(v) => onChange({ account: v })}
        options={withAny(options.accounts)}
        containerClassName={styles.filterField}
      />
      <Select
        label={COPY.status}
        value={filter.status}
        onValueChange={(v) => onChange({ status: v })}
        options={STATUS_OPTIONS}
        containerClassName={styles.filterField}
      />
      <Select
        label={COPY.character}
        value={filter.profile}
        onValueChange={(v) => onChange({ profile: v })}
        options={withAny(options.profiles)}
        containerClassName={styles.filterField}
      />
      <Select
        label={COPY.model}
        value={filter.model}
        onValueChange={(v) => onChange({ model: v })}
        options={withAny(options.models)}
        containerClassName={styles.filterFieldWide}
      />
      {canClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className={styles.clearFilters}>
          {COPY.clear}
        </Button>
      )}
    </div>
  );
}
