import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys, rentersApi } from '@/api'

/**
 * Danh sách / tìm người thuê. Có `idNumber` → POST /renters/search (số giấy tờ trong body, khớp chính xác);
 * không có → GET /renters?q=.
 */
export function useRenterList(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.renters.list(params),
    queryFn: ({ signal }) =>
      params.idNumber
        ? rentersApi.search({ q: params.q ?? null, idNumber: params.idNumber, idType: params.idType ?? null, page: params.page ?? 1, pageSize: params.pageSize }, { signal })
        : rentersApi.list(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useRenter(id) {
  return useQuery({
    queryKey: queryKeys.renters.detail(id),
    queryFn: ({ signal }) => rentersApi.get(id, { signal }),
    enabled: Boolean(id),
  })
}
