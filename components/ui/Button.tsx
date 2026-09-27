import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'icon';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Style the single child element (e.g. a `Link`) as the button instead of rendering a `<button>`. */
  asChild?: boolean;
};

function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string): string {
  return cn('prr-btn', `prr-btn--${variant}`, `prr-btn--${size}`, className);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading = false, asChild = false, className, disabled, type, children, ...props }, ref) => {
    const classes = buttonClass(variant, size, className);

    if (asChild && React.isValidElement<{ className?: string }>(children)) {
      return React.cloneElement(children, { className: cn(classes, children.props.className) });
    }

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={classes}
        disabled={disabled ?? loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <span className="prr-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonClass };
export type { ButtonProps, ButtonVariant, ButtonSize };
