"use client";

import { EmptyState } from "./empty-state";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  hideOnMobile?: boolean;
  render: (row: T) => React.ReactNode;
  mobileLabel?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyTitle = "No records found",
  emptyDescription,
  actions,
}: DataTableProps<T>) {
  if (!data.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="space-y-2">
              {columns.filter((column) => !column.hideOnMobile).map((column) => (
                <div key={column.key} className="flex min-w-0 items-start justify-between gap-3">
                  <span className="max-w-[42%] shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {column.mobileLabel || column.header}
                  </span>
                  <div className="min-w-0 break-words text-right text-sm text-slate-800">{column.render(row)}</div>
                </div>
              ))}
            </div>
            {actions ? (
              <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                {actions(row)}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-slate-500">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-4 py-3 font-medium ${column.className || ""}`}
                >
                  {column.header}
                </th>
              ))}
              {actions ? <th className="px-4 py-3 text-right font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => (
              <tr key={keyExtractor(row)} className="hover:bg-slate-50/70">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-4 py-3 text-slate-700 ${column.className || ""}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {actions ? (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">{actions(row)}</div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
