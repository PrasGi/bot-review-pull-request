'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LoginCard } from '@/components/auth/LoginCard';
import { mutateJson, FetchError } from '@/lib/ui/swr';
import styles from './page.module.css';

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async ({ email, password }: { email: string; password: string }): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      await mutateJson('/api/auth/login', 'POST', { email, password });
      router.push('/');
      router.refresh();
    } catch (err) {
      const message = err instanceof FetchError ? err.message : 'Something went wrong';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <LoginCard onSubmit={handleSubmit} loading={loading} error={error} />
    </main>
  );
}
