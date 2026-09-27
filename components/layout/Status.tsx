import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Tooltip } from '@/components/ui/Tooltip';

type SystemStatus = 'healthy' | 'degraded' | 'down';

const STATUS_LABEL: Record<SystemStatus, string> = { healthy: 'Healthy', degraded: 'Degraded', down: 'Down' };

type StatusDotProps = { status?: SystemStatus; label?: string; tooltip?: string; hideLabel?: boolean };

function StatusDot({ status = 'healthy', label, tooltip, hideLabel = false }: StatusDotProps): React.ReactElement {
  const text = label ?? STATUS_LABEL[status];
  return (
    <Tooltip content={tooltip ?? `System ${text.toLowerCase()}`}>
      <span
        className={cn('prr-status', `prr-status--${status}`)}
        role="status"
        tabIndex={0}
        aria-label={`System status: ${text.toLowerCase()}`}
      >
        <span className="prr-status-dot" aria-hidden="true" />
        {!hideLabel && <span>{text}</span>}
      </span>
    </Tooltip>
  );
}

type LiveIndicatorProps = { label?: string; ariaLabel?: string };

function LiveIndicator({ label = 'Live · updates every 5s', ariaLabel = 'Auto-refreshing' }: LiveIndicatorProps): React.ReactElement {
  return (
    <span className="prr-live" role="status" aria-label={ariaLabel}>
      <span className="prr-live-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export { StatusDot, LiveIndicator };
export type { SystemStatus };
