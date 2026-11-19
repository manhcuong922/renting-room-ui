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
    // Rời trang là bỏ bản lưu: vào lại luôn thấy dữ liệu mới (trạng thái, cọc, thanh lý đổi liên tục), không thoáng hiện bản cũ.
    gcTime: 0,
  })
}

export function useBillingPeriods(id, until) {
  return useQuery({
    queryKey: queryKeys.contracts.billingPeriods(id, until),
    queryFn: ({ signal }) => contractsApi.billingPeriods(id, { until: until || undefined }, { signal }),
    enabled: Boolean(id),
  })
}

/** Khoảng ngắt tính tiền (kỳ đã thu ngoài hệ thống) của HĐ — cũ trước. resumedInvoiceId = phiếu nối tiếp; xóa nháp / hủy phiếu đó thì khoảng mất. */
export function useBillingGaps(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.contracts.billingGaps(id),
    queryFn: ({ signal }) => contractsApi.billingGaps(id, { signal }),
    enabled: Boolean(id) && enabled,
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
