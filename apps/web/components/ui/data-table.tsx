'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Message shown when there are no rows */
  emptyMessage?: string
  /** Optional global filter value (e.g. search). Enables getFilteredRowModel when set. */
  globalFilter?: string
  /** Optional class for the table wrapper */
  className?: string
  /** When set, rows are clickable and trigger this callback (clicks on links/buttons are ignored) */
  onRowClick?: (row: TData) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = 'No results.',
  globalFilter,
  className,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(globalFilter !== undefined && {
      getFilteredRowModel: getFilteredRowModel(),
      state: { globalFilter: globalFilter || '' },
    }),
  })

  const rows = table.getRowModel().rows
  const headerGroups = table.getHeaderGroups()

  return (
    <div className={cn('relative w-full overflow-auto', className)}>
      <Table>
        <TableHeader>
          {headerGroups.map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    (header.column.columnDef.meta as { className?: string })?.className
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                className={onRowClick ? 'cursor-pointer' : undefined}
                onClick={
                  onRowClick
                    ? (e) => {
                        const target = e.target as HTMLElement
                        if (target.closest('a, button')) return
                        onRowClick(row.original)
                      }
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      (cell.column.columnDef.meta as { className?: string })?.className
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
