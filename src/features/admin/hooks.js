import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { adminApi, queryKeys } from '@/api'

export function useOrganizationList(params) {
  return useQuery({
    queryKey: queryKeys.organizations.list(params),
    queryFn: ({ signal }) => adminApi.listOrganizations(params, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useOrganization(id) {
  return useQuery({
    queryKey: queryKeys.organizations.detail(id),
    queryFn: ({ signal }) => adminApi.getOrganization(id, { signal }),
  })
}
