'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { GitPullRequest } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { mutateJson, FetchError } from '@/lib/ui/swr';

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await mutateJson('/api/auth/login', 'POST', { email, password });
      router.push('/');
      router.refresh();
    } catch (err) {
      const message =
        err instanceof FetchError ? err.message : 'Something went wrong';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <GlassCard className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)]">
            <GitPullRequest
              className="h-6 w-6 text-[var(--accent-fg)]"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">
              PR Reviewer
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Sign in to your dashboard
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          {error && (
            <p className="text-sm text-[oklch(0.60_0.20_25)]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
