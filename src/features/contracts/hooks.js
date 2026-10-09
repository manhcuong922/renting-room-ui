import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { contractsApi, invoicesApi, queryKeys } from '@/api'

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

/** Phiếu quyết toán (type Final, chưa hủy) của HĐ đang thanh lý — để biết đã lập / đã chốt chưa. */
export function useFinalInvoice(c, { enabled }) {
  return useQuery({
    queryKey: queryKeys.invoices.list({ contractId: c.id, final: true }),
    queryFn: async ({ signal }) => {
      const page = await invoicesApi.list({ contractId: c.id, pageSize: 100 }, { signal })
      return page.items.find((i) => i.type === 'Final' && i.status !== 'Void') ?? null
    },
    enabled,
  })
}

/** Danh sách vấn đề dữ liệu cần xem lại của HĐ đang hiệu lực / thanh lý (chỉ đọc). */
export function useContractDataReview(propertyId) {
  return useQuery({
    queryKey: queryKeys.contracts.dataReview(propertyId),
    queryFn: ({ signal }) => contractsApi.dataReview({ propertyId: propertyId || undefined }, { signal }),
  })
}
