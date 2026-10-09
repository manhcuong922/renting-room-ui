// Quy tắc hiển thị nút theo trạng thái — bảng "Ma trận nút theo trạng thái" (docs/api/contracts.md).
import { formatDate, todayVN } from '@/lib/format'

export function contractActions(c) {
  const draft = c.status === 'Draft'
  const active = c.status === 'Active'
  const liquidating = c.status === 'Liquidating'
  const flags = c.flags ?? []
  return {
    edit: draft,
    editNote: c.status !== 'Cancelled',
    cancel: draft,
    activate: draft,
    assetsEdit: draft,
    assetReturn: liquidating,
    addOccupant: draft || active,
    endOccupancy: active || liquidating,
    addVehicle: draft || active,
    endVehicle: draft || active || liquidating,
    changeRent: active,
    changeFees: active,
    extend: active && Boolean(c.endDate),
    // Quá hạn mà chủ trọ chưa quyết định → "Cho ở tiếp, chưa ký lại".
    holdover: active && flags.includes('ExpiredAwaitingDecision'),
    // Ký lại cho người còn ở (hay dùng khi người ký đã rời đi).
    reSign: active,
    signedDocument: c.status !== 'Cancelled',
    downloadDocument: c.status !== 'Cancelled',
    notice: active,
    startLiquidation: active,
    cancelLiquidation: liquidating,
    finalInvoice: liquidating,
    completeLiquidation: liquidating,
    // Hoàn tất được từ ngày trả phòng (LIQUIDATION_BEFORE_END_DATE).
    canCompleteToday: liquidating && Boolean(c.actualEndDate) && todayVN() >= c.actualEndDate,
  }
}

/** Đang ở = chưa chuyển đi, hoặc ngày chuyển đi ≥ hôm nay. */
export const isCurrentOccupant = (o) => !o.moveOutDate || o.moveOutDate >= todayVN()
export const isActiveVehicle = (v) => !v.registeredTo

/** "02/10/2026 → 01/10/2027" — ưu tiên ngày trả phòng thực tế; không có ngày kết thúc = "Không thời hạn". */
export function formatContractTerm(c) {
  const end = c.actualEndDate ?? c.endDate
  return `${formatDate(c.startDate)} → ${end ? formatDate(end) : 'Không thời hạn'}`
}
