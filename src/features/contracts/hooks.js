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

/**
 * Màn thanh lý (contracts.md#xem-trước): kỳ cuối + số tiền 3 cách, kỳ chưa chốt, hóa đơn từ ngày trả phòng, nợ, cần trả lại, khoản chưa xử lý, cọc.
 * HĐ còn hiệu lực: `actualEndDate` để xem trước trước khi bắt đầu thanh lý.
 */
export function useLiquidationPreview(id, { enabled, actualEndDate }) {
  return useQuery({
    queryKey: queryKeys.contracts.liquidationPreview(id, actualEndDate),
    queryFn: ({ signal }) => contractsApi.liquidationPreview(id, { actualEndDate: actualEndDate || undefined }, { signal }),
    enabled,
    placeholderData: keepPreviousData,
  })
}

/** Danh sách vấn đề dữ liệu cần xem lại của HĐ đang hiệu lực / thanh lý (chỉ đọc). */
export function useContractDataReview(propertyId) {
  return useQuery({
    queryKey: queryKeys.contracts.dataReview(propertyId),
    queryFn: ({ signal }) => contractsApi.dataReview({ propertyId: propertyId || undefined }, { signal }),
  })
}
