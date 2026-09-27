import * as React from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import styles from './invite.module.css';

type InviteStateProps = {
  badge: string;
  tone: BadgeVariant;
  title: string;
  body: string;
  children?: React.ReactNode;
};

/** The centred status card shared by the invite and confirmation pages. */
export function InviteState({ badge, tone, title, body, children }: InviteStateProps): React.ReactElement {
  return (
    <Card className={styles.state}>
      <span className="prr-brand-mark is-lg" aria-hidden="true">
        <Icon name="pr" size={24} />
      </span>
      <Badge variant={tone}>{badge}</Badge>
      <h1 className={styles.stateTitle}>{title}</h1>
      <p className={styles.body}>{body}</p>
      {children}
    </Card>
  );
}
