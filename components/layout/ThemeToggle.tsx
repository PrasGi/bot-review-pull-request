'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { useMounted } from '@/lib/ui/use-mounted';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';

type ThemeToggleProps = { tooltipSide?: 'top' | 'bottom' | 'right' };

function ThemeToggle({ tooltipSide }: ThemeToggleProps): React.ReactElement {
  const { resolvedTheme, setTheme } = useTheme();
  // The server cannot know the resolved theme; render the light-mode glyph until hydrated.
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Tooltip content="Toggle theme" side={tooltipSide}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        <span className="prr-theme-glyph" key={isDark ? 'dark' : 'light'}>
          <Icon name={isDark ? 'sun' : 'moon'} />
        </span>
      </Button>
    </Tooltip>
  );
}

export { ThemeToggle };
