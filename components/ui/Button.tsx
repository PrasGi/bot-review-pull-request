'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/ui/cn';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-medium transition-all',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'select-none whitespace-nowrap shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--accent)] text-[var(--accent-fg)]',
          'hover:bg-[var(--accent-hover)] active:scale-[0.98]',
          'shadow-sm',
        ],
        secondary: [
          'glass-btn text-[var(--text)]',
          'hover:bg-[var(--nav-hover)] active:scale-[0.98]',
        ],
        destructive: [
          'bg-[oklch(0.60_0.20_25)] text-white',
          'hover:bg-[oklch(0.54_0.22_25)] active:scale-[0.98]',
          'shadow-sm',
        ],
        ghost: [
          'text-[var(--text-muted)]',
          'hover:bg-[var(--nav-hover)] hover:text-[var(--text)]',
          'active:scale-[0.98]',
        ],
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-[var(--radius-btn)]',
        md: 'h-10 px-4 text-sm rounded-[var(--radius-btn)]',
        icon: 'h-9 w-9 rounded-[var(--radius-btn)] p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

function Spinner(): React.ReactElement {
  return (
    <svg
      className="animate-spin h-4 w-4 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref
  ): React.ReactElement => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? loading}
        aria-busy={loading}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
export type { ButtonProps };
