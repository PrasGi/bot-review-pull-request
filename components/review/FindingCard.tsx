import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { severityTone } from '@/lib/ui/tones';
import { Badge } from '@/components/ui/Badge';
import { CodeBlock } from './CodeBlock';

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

export { FindingCard };
export type { FindingCardProps };
