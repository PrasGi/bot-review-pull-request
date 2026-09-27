import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { CodeBlock } from './CodeBlock';

// critical/major → error, minor → warning, nit (and anything unknown) → neutral.
const SEVERITY_TONE: Record<string, 'error' | 'warning'> = { critical: 'error', major: 'error', minor: 'warning' };

function severityTone(severity: string): BadgeVariant {
  return SEVERITY_TONE[severity] ?? 'neutral';
}

type FindingCardProps = {
  severity: string;
  category?: string;
  location?: string;
  comment: React.ReactNode;
  suggestion?: string;
  blocking?: boolean;
  posted?: boolean;
  className?: string;
};

function FindingCard({ severity, category, location, comment, suggestion, blocking, posted, className }: FindingCardProps): React.ReactElement {
  const tone = severityTone(severity);
  return (
    <article className={cn('prr-finding', `prr-finding--${tone}`, className)}>
      <div className="prr-finding-head">
        <Badge variant={tone}>{severity}</Badge>
        {category && <Badge variant="neutral">{category}</Badge>}
        {location && <code className="prr-finding-loc">{location}</code>}
      </div>
      <p className="prr-finding-text">{comment}</p>
      {suggestion && <CodeBlock label="Suggestion">{suggestion}</CodeBlock>}
      {(blocking || posted) && (
        <div className="prr-finding-flags">
          {blocking && <span className="is-blocking">■ blocking</span>}
          {posted && <span className="is-posted">✓ posted</span>}
        </div>
      )}
    </article>
  );
}

export { FindingCard, severityTone };
export type { FindingCardProps };
