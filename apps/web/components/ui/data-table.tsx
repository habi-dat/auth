'use client'

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100]

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Message shown when there are no rows */
  emptyMessage?: string
  /** Placeholder for the search input. Set to empty string to hide the search bar. */
  searchPlaceholder?: string
  /** Default page size (used when search is hidden or shown). */
  pageSize?: number
  /** Optional class for the table wrapper (excluding toolbar and footer). */
  className?: string
  /** When set, rows are clickable and trigger this callback (clicks on links/buttons are ignored) */
  onRowClick?: (row: TData) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage,
  searchPlaceholder,
  pageSize: initialPageSize = 25,
  className,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations('dataTable')
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  })

  const pageSizeOptions = useMemo(() => {
    const set = new Set([...DEFAULT_PAGE_SIZES, initialPageSize])
    return Array.from(set).sort((a, b) => a - b)
  }, [initialPageSize])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: {
      globalFilter,
      sorting,
      pagination,
    },
    manualPagination: false,
    manualSorting: false,
    manualFiltering: false,
  })

  const rows = table.getRowModel().rows
  const headerGroups = table.getHeaderGroups()
  const pageCount = table.getPageCount()
  const filteredRowCount = table.getFilteredRowModel().rows.length
  const isFiltered = globalFilter.length > 0
  const start = filteredRowCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const end = Math.min(pagination.pageIndex * pagination.pageSize + rows.length, filteredRowCount)

  const showSearch = searchPlaceholder !== ''
  const emptyMsg = emptyMessage ?? t('noResults')

  return (
    <div className="flex flex-col gap-4">
      {showSearch && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={searchPlaceholder ?? t('searchPlaceholder')}
              value={globalFilter}
              onChange={(e) => {
                setGlobalFilter(e.target.value)
                table.setPageIndex(0)
              }}
              className="pl-9"
              aria-label={t('searchAriaLabel')}
            />
          </div>
        </div>
      )}

      <div className={cn('relative w-full overflow-auto', className)}>
        <Table>
          <TableHeader>
            {headerGroups.map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.getCanSort() && 'cursor-pointer select-none hover:bg-muted/50',
                      (header.column.columnDef.meta as { className?: string })?.className
                    )}
                    onClick={
                      header.column.getCanSort()
                        ? () => header.column.toggleSorting(header.column.getIsSorted() === 'asc')
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-muted-foreground">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="h-4 w-4 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
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
                  {emptyMsg}
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

      {data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {filteredRowCount === 0 ? '0' : `${start}–${end}`} {t('of')} {filteredRowCount}
              {isFiltered &&
                data.length !== filteredRowCount &&
                ` (${t('filteredFrom', { count: data.length })})`}
            </span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
                table.setPageIndex(0)
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>{t('perPage')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label={t('previousPage')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[100px] text-center text-sm text-muted-foreground">
              {t('pageOf', {
                current: pagination.pageIndex + 1,
                total: pageCount || 1,
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label={t('nextPage')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
