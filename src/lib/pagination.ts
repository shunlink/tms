export type PageParams = {
  page?: number | string;
  pageSize?: number | string;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export function parsePagination(
  searchParams?: Record<string, string | string[] | undefined> | PageParams
): { skip: number; take: number; page: number; pageSize: number } {
  const raw =
    searchParams && "page" in searchParams && typeof searchParams.page !== "object"
      ? searchParams
      : {
          page: Array.isArray((searchParams as Record<string, string | string[] | undefined>)?.page)
            ? (searchParams as Record<string, string | string[] | undefined>).page?.[0]
            : (searchParams as Record<string, string | string[] | undefined>)?.page,
          pageSize: Array.isArray(
            (searchParams as Record<string, string | string[] | undefined>)?.pageSize
          )
            ? (searchParams as Record<string, string | string[] | undefined>).pageSize?.[0]
            : (searchParams as Record<string, string | string[] | undefined>)?.pageSize,
        };

  const page = Math.max(1, Number(raw.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(raw.pageSize) || DEFAULT_PAGE_SIZE));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
