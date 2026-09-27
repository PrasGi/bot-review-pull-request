import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type AvatarProps = {
  name?: string;
  src?: string;
  size?: number;
  initials?: string;
  tone?: 'accent';
  className?: string;
};

function Avatar({ name, src, size = 40, initials, tone, className }: AvatarProps): React.ReactElement {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (src) {
    // Remote GitHub avatars; next/image would need the host allowlisted for no real gain at 40px.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cn('prr-avatar', className)} src={src} alt={name ?? ''} width={size} height={size} style={style} />;
  }
  const initial = ((name ?? '').trim().charAt(0) || '?').toUpperCase();
  return (
    <span className={cn('prr-avatar', tone && `prr-avatar--${tone}`, className)} style={style} aria-hidden="true">
      {initials ?? initial}
    </span>
  );
}

export { Avatar };
export type { AvatarProps };
