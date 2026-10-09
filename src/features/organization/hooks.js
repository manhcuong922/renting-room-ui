import { useQuery } from '@tanstack/react-query'
import { organizationApi, queryKeys } from '@/api'

export function useOrganizationLessor() {
  return useQuery({
    queryKey: queryKeys.organization.lessor,
    queryFn: ({ signal }) => organizationApi.getLessor({ signal }),
  })
}
