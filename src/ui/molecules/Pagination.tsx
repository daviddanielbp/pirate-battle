import { IconButton } from '@/ui/atoms/IconButton';
import './Pagination.css';

export interface PaginationTestIds {
  prev?: string | undefined;
  next?: string | undefined;
  label?: string | undefined;
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean | undefined;
  ariaLabel?: string | undefined;
  previousLabel?: string | undefined;
  nextLabel?: string | undefined;
  formatPageLabel?: ((page: number, totalPages: number) => string) | undefined;
  testIds?: PaginationTestIds | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  disabled = false,
  ariaLabel = 'Pagination',
  previousLabel = 'Previous page',
  nextLabel = 'Next page',
  formatPageLabel,
  testIds,
  className,
  testId,
}: PaginationProps) {
  const lastPage = Math.max(1, totalPages);
  const currentPage = Math.min(lastPage, Math.max(1, page));
  const canGoBack = !disabled && currentPage > 1;
  const canGoForward = !disabled && currentPage < lastPage;

  return (
    <nav
      aria-label={ariaLabel}
      className={['pb-pagination', className ?? ''].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      <IconButton
        icon="turnLeft"
        label={previousLabel}
        size={40}
        disabled={!canGoBack}
        testId={testIds?.prev}
        onClick={() => onChange(currentPage - 1)}
      />
      <span className="pb-pagination__label pb-eyebrow" aria-live="polite" data-testid={testIds?.label}>
        {formatPageLabel ? formatPageLabel(currentPage, lastPage) : `Page ${currentPage} of ${lastPage}`}
      </span>
      <IconButton
        icon="turnRight"
        label={nextLabel}
        size={40}
        disabled={!canGoForward}
        testId={testIds?.next}
        onClick={() => onChange(currentPage + 1)}
      />
    </nav>
  );
}
