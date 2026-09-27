import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StatusDot, type SystemStatus } from './Status';
import { ThemeToggle } from './ThemeToggle';
import { WhatsNew } from './WhatsNew';

type HeaderProps = {
  title?: React.ReactNode;
  onMenuClick?: () => void;
  status?: SystemStatus;
  actions?: React.ReactNode;
};

function Header({ title, onMenuClick, status = 'healthy', actions }: HeaderProps): React.ReactElement {
  return (
    <header className="prr-header">
      <Button variant="ghost" size="icon" className="prr-header-menu" aria-label="Open navigation" onClick={onMenuClick}>
        <Icon name="menu" size={18} />
      </Button>
      <div className="prr-header-title">{title && <h1>{title}</h1>}</div>
      <div className="prr-header-actions">
        {actions}
        <WhatsNew />
        <ThemeToggle />
        <StatusDot status={status} />
      </div>
    </header>
  );
}

export { Header };
export type { HeaderProps };
