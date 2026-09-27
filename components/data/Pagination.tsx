import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

type PaginationProps = {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  className?: string;
};

function Pagination({ page, totalPages, total, onPageChange, className }: PaginationProps): React.ReactElement {
  const pages = Math.max(1, totalPages);
  return (
    <div className={cn('prr-pager', className)}>
      <p className="prr-pager-info">
        Page {page} of {pages}
        {total !== undefined && ` · ${total} total`}
      </p>
      <div className="prr-pager-btns">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <Icon name="chevronLeft" size={14} />
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next
          <Icon name="chevronRight" size={14} />
        </Button>
      </div>
    </div>
  );
}

export { Pagination };
export type { PaginationProps };
