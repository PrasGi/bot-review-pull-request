'use client';

import * as React from 'react';
import * as RadixSlider from '@radix-ui/react-slider';
import { cn } from '@/lib/ui/cn';

type SliderProps = RadixSlider.SliderProps & {
  className?: string;
};

const Slider = React.forwardRef<
  React.ComponentRef<typeof RadixSlider.Root>,
  SliderProps
>(({ className, ...props }, ref): React.ReactElement => (
  <RadixSlider.Root
    ref={ref}
    className={cn(
      'relative flex w-full touch-none select-none items-center',
      className
    )}
    {...props}
  >
    <RadixSlider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--nav-hover)]">
      <RadixSlider.Range className="absolute h-full bg-[var(--accent)]" />
    </RadixSlider.Track>
    {(props.value ?? props.defaultValue ?? [0]).map((v) => (
      <RadixSlider.Thumb
        key={v}
        className={cn(
          'block h-4 w-4 rounded-full bg-[var(--accent)] shadow-sm ring-[var(--accent-subtle)]',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50 hover:bg-[var(--accent-hover)]'
        )}
      />
    ))}
  </RadixSlider.Root>
));
Slider.displayName = 'Slider';

export { Slider };
export type { SliderProps };
