import { useMemo } from 'react'

export const TABLE_PAGE_SIZE = 30

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type TablePaginationProps = {
  currentPage: number
  pageSize: number
  totalCount: number
  itemCount?: number
  onPageChange: (page: number) => void
}

function TablePagination({
  currentPage,
  pageSize,
  totalCount,
  itemCount = pageSize,
  onPageChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))
  const showingFrom = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const showingTo =
    totalCount === 0
      ? 0
      : Math.min((currentPage - 1) * pageSize + itemCount, totalCount)

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const pages = new Set<number>([
      1,
      totalPages,
      currentPage - 1,
      currentPage,
      currentPage + 1,
    ])

    return Array.from(pages)
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
      .sort((left, right) => left - right)
  }, [currentPage, totalPages])

  return (
    <div className="flex flex-col gap-4 border-t border-slate-200 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-sm text-slate-600">
        Mostrando {showingFrom}–{showingTo} de {totalCount}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronIcon direction="left" />
          Anterior
        </button>

        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            className={[
              'inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-medium transition',
              pageNumber === currentPage
                ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[#8a6c16]'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
            ].join(' ')}
          >
            {pageNumber}
          </button>
        ))}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
          <ChevronIcon direction="right" />
        </button>
      </div>
    </div>
  )
}

export default TablePagination
