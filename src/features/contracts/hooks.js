import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { contractsApi, queryKeys } from '@/api'

export function useContractList(params) {
  return useQuery({
    queryKey: queryKeys.contracts.list(params),
    queryFn: ({ signal }) => contractsApi.list(params, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useContract(id) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: ({ signal }) => contractsApi.get(id, { signal }),
    enabled: Boolean(id),
  })
}

export function useBillingPeriods(id, until) {
  return useQuery({
    queryKey: queryKeys.contracts.billingPeriods(id, until),
    queryFn: ({ signal }) => contractsApi.billingPeriods(id, { until: until || undefined }, { signal }),
    enabled: Boolean(id),
  })
}
