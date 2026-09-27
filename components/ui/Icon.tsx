import * as React from 'react';
import { cn } from '@/lib/ui/cn';

// Square-capped glyphs on a 24px grid, drawn with a heavy stroke to match the
// kit's borders. The first block is the design system's set; the last block
// (calendar → trash) is drawn in the same style for screens that need it.
const ICONS = {
  dashboard: 'M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z',
  pr: 'M6 3v12M6 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6M18 21V9a3 3 0 0 0-3-3h-4M13 3l-3 3l3 3M18 15a3 3 0 1 0 0 6',
  chart: 'M3 3v18h18M7 17v-5M12 17V7M17 17v-8',
  folder: 'M3 5h7l2 3h9v11H3zM12 11v5M12 11a2 2 0 1 0 0-.1',
  settings: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  chevronLeft: 'M15 5l-7 7l7 7',
  chevronRight: 'M9 5l7 7l-7 7',
  chevronDown: 'M5 9l7 7l7-7',
  arrowLeft: 'M20 12H4M10 6l-6 6l6 6',
  bell: 'M6 16V10a6 6 0 0 1 12 0v6l2 2H4zM10 21h4',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  more: 'M12 5v.01M12 12v.01M12 19v.01',
  logout: 'M9 3H4v18h5M16 17l5-5l-5-5M21 12H9',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 3',
  wifiOff: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M12 20v.01M19 13a10 10 0 0 0-2-1.6',
  check: 'M4 12l5 5L20 6',
  checkCheck: 'M2 12l5 5L18 6M12 17l1 1l9-11',
  external: 'M14 3h7v7M21 3l-9 9M18 14v7H3V6h7',
  download: 'M12 3v12M6 10l6 6l6-6M4 21h16',
  fork: 'M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V3M12 12v6M12 18a2 2 0 1 0 0 4',
  building: 'M4 21V3h11v18M15 9h5v12M8 7h3M8 11h3M8 15h3M2 21h20',
  user: 'M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M4 21a8 8 0 0 1 16 0',
  plug: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
  search: 'M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14M21 21l-6-6',
  x: 'M5 5l14 14M19 5L5 19',
  plus: 'M12 4v16M4 12h16',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  dollar: 'M12 2v20M17 6H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6',
  timer: 'M12 8a7 7 0 1 0 0 14a7 7 0 1 0 0-14M12 11v4M9 2h6M19 6l-2 2',
  link: 'M10 14l4-4M9 7l2-2a4 4 0 0 1 6 6l-2 2M15 17l-2 2a4 4 0 0 1-6-6l2-2',
  trash: 'M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
} as const;

type IconName = keyof typeof ICONS;
const ICON_NAMES = Object.keys(ICONS) as IconName[];

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Accessible name. Without it the icon is decorative and hidden from assistive tech. */
  label?: string;
  className?: string;
};

function Icon({ name, size = 16, strokeWidth = 2.5, label, className }: IconProps): React.ReactElement {
  return (
    <svg
      className={cn('prr-icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

type IconLike = IconName | React.ReactElement;

/** Renders a named icon, or passes a ready element through unchanged. */
function renderIcon(icon: IconLike, size?: number): React.ReactElement {
  return typeof icon === 'string' ? <Icon name={icon} size={size} /> : icon;
}

export { Icon, ICON_NAMES, renderIcon };
export type { IconName, IconProps, IconLike };
