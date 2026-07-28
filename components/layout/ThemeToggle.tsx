'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';

function ThemeToggle(): React.ReactElement {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Tooltip content="Toggle theme">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        suppressHydrationWarning
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </Tooltip>
  );
}

export { ThemeToggle };
