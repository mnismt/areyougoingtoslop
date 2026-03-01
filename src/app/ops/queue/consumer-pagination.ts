export const CONSUMERS_PAGE_SIZE = 10

const getSafePageSize = (pageSize: number) => {
  if (!Number.isFinite(pageSize) || pageSize < 1) {
    return CONSUMERS_PAGE_SIZE
  }

  return Math.trunc(pageSize)
}

export const getTotalPages = (totalItems: number, pageSize: number) => {
  const safePageSize = getSafePageSize(pageSize)
  return Math.max(1, Math.ceil(Math.max(0, totalItems) / safePageSize))
}

export const clampPage = (
  page: number,
  totalItems: number,
  pageSize: number,
) => {
  const totalPages = getTotalPages(totalItems, pageSize)
  if (!Number.isFinite(page)) {
    return 1
  }

  return Math.min(Math.max(1, Math.trunc(page)), totalPages)
}

export const getPageRange = (
  page: number,
  totalItems: number,
  pageSize: number,
): { start: number; end: number } => {
  const count = Math.max(0, totalItems)
  if (count === 0) {
    return { start: 0, end: 0 }
  }

  const safePage = clampPage(page, count, pageSize)
  const safePageSize = getSafePageSize(pageSize)
  const start = (safePage - 1) * safePageSize + 1
  const end = Math.min(safePage * safePageSize, count)

  return { start, end }
}

export function pageWindow(
  current: number,
  total: number,
): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const pages: (number | 'ellipsis')[] = [1]

  if (current > 3) {
    pages.push('ellipsis')
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let index = start; index <= end; index += 1) {
    pages.push(index)
  }

  if (current < total - 2) {
    pages.push('ellipsis')
  }

  pages.push(total)

  return pages
}
