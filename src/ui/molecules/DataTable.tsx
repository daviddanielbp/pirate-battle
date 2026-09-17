import type { ReactNode } from 'react';
import './DataTable.css';

export type DataTableAlign = 'left' | 'right' | 'center';

export interface DataTableColumn<K extends string> {
  key: K;
  header: string;
  align?: DataTableAlign | undefined;
  width?: string | undefined;
}

export interface DataTableRow<K extends string> {
  id: string;
  cells: Record<K, ReactNode>;
  highlighted?: boolean | undefined;
  testId?: string | undefined;
}

export interface DataTableProps<K extends string> {
  columns: DataTableColumn<K>[];
  rows: DataTableRow<K>[];
  caption: string;
  emptyMessage?: string | undefined;
  minWidth?: string | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

export function DataTable<K extends string>({
  columns,
  rows,
  caption,
  emptyMessage = 'Nothing to show yet.',
  minWidth = '520px',
  className,
  testId,
}: DataTableProps<K>) {
  return (
    <div className={['pb-table-wrap', className ?? ''].filter(Boolean).join(' ')} data-testid={testId}>
      <table className="pb-table" style={{ minWidth }}>
        <caption className="pb-sr-only">{caption}</caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={column.width === undefined ? undefined : { width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`pb-table__head pb-table__cell--${column.align ?? 'left'}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="pb-table__row pb-table__row--empty">
              <td colSpan={columns.length} className="pb-table__cell pb-table__cell--center pb-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className={['pb-table__row', row.highlighted ? 'pb-table__row--highlighted' : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-current={row.highlighted ? 'true' : undefined}
                data-testid={row.testId}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`pb-table__cell pb-table__cell--${column.align ?? 'left'}`}>
                    {row.cells[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
