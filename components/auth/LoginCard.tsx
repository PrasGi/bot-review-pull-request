'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input, PasswordInput } from '@/components/ui/Input';

type LoginCardProps = {
  onSubmit: (values: { email: string; password: string }) => void;
  loading?: boolean;
  error?: string | null;
  title?: string;
  subtitle?: string;
};

function LoginCard({
  onSubmit,
  loading = false,
  error,
  title = 'PR Reviewer',
  subtitle = 'Sign in to your dashboard',
}: LoginCardProps): React.ReactElement {
  return (
    <Card className="prr-login">
      <div className="prr-login-head">
        <span className="prr-brand-mark is-lg" aria-hidden="true">
          <Icon name="pr" size={24} />
        </span>
        <h1 className="prr-login-title">{title}</h1>
        <p className="prr-hint">{subtitle}</p>
      </div>
      <form
        className="prr-login-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          onSubmit({ email: String(data.get('email') ?? ''), password: String(data.get('password') ?? '') });
        }}
      >
        <Input label="Email" name="email" type="email" autoComplete="email" required disabled={loading} />
        <PasswordInput label="Password" name="password" autoComplete="current-password" required disabled={loading} />
        {error && (
          <p className="prr-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={loading} className="prr-w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Card>
  );
}

export { LoginCard };
export type { LoginCardProps };
