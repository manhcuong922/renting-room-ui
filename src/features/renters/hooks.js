import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys, rentersApi } from '@/api'

export function useRenterList(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.renters.list(params),
    queryFn: ({ signal }) => rentersApi.list(params, { signal }),
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
