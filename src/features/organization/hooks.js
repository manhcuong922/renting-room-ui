import { useQuery } from '@tanstack/react-query'
import { organizationApi, queryKeys } from '@/api'

export function useOrganizationInfo() {
  return useQuery({
    queryKey: queryKeys.organization.info,
    queryFn: ({ signal }) => organizationApi.getInfo({ signal }),
  })
}

export function useOrganizationLessor() {
  return useQuery({
    queryKey: queryKeys.organization.lessor,
    queryFn: ({ signal }) => organizationApi.getLessor({ signal }),
  })
}

export function useDataRetention() {
  return useQuery({
    queryKey: queryKeys.organization.dataRetention,
    queryFn: ({ signal }) => organizationApi.getDataRetention({ signal }),
  })
}
