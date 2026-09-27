import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type CodeBlockProps = { children: React.ReactNode; label?: string; maxHeight?: number; className?: string };

/** Preformatted text, rendered as text only (never HTML). */
function CodeBlock({ children, label, maxHeight, className }: CodeBlockProps): React.ReactElement {
  return (
    <div className={cn('prr-code', className)}>
      {label && <div className="prr-code-label">{label}</div>}
      <pre style={maxHeight ? { maxHeight } : undefined}>{children}</pre>
    </div>
  );
}

export { CodeBlock };
export type { CodeBlockProps };
