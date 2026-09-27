'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/Input';

type ProviderKeyRowProps = {
  provider: string;
  label?: string;
  isSet: boolean;
  saving?: boolean;
  onSave: (value: string) => void;
};

function ProviderKeyRow({ provider, label, isSet, saving = false, onSave }: ProviderKeyRowProps): React.ReactElement {
  const [value, setValue] = React.useState('');
  const name = label ?? provider.charAt(0).toUpperCase() + provider.slice(1);
  return (
    <div className="prr-key-row">
      <div className="prr-key-head">
        <span className="prr-key-name">{name}</span>
        <Badge variant={isSet ? 'success' : 'neutral'}>{isSet ? '✓ Configured' : 'Not set'}</Badge>
      </div>
      <div className="prr-key-input">
        <PasswordInput
          aria-label={`${name} API key`}
          placeholder={isSet ? 'Enter new key to replace' : 'Enter API key'}
          value={value}
          disabled={saving}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          containerClassName="prr-grow"
        />
        <Button
          variant="secondary"
          loading={saving}
          disabled={!value.trim()}
          onClick={() => {
            onSave(value.trim());
            setValue('');
          }}
        >
          Save key
        </Button>
      </div>
    </div>
  );
}

export { ProviderKeyRow };
export type { ProviderKeyRowProps };
