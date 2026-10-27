// Quy tắc hiển thị nút theo trạng thái — bảng "Ma trận nút theo trạng thái" (docs/api/contracts.md).
import { formatDate, todayVN } from '@/lib/format'

export function contractActions(c) {
  const draft = c.status === 'Draft'
  const active = c.status === 'Active'
  const liquidating = c.status === 'Liquidating'
  const flags = c.flags ?? []
  // Chuyển nhầm: trong ngày chuyển (roomSince = hôm nay) chỉ chuyển lại được về phòng vừa rời ⇒ như chưa từng chuyển (contracts.md#chuyển-phòng).
  const transferBack = active && (c.roomMoves?.length ?? 0) > 0 && c.roomSince === todayVN()
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
    // Có hạn, hoặc đang "ở tiếp" (không thời hạn nhưng còn previousEndDate) thì gia hạn được; không thời hạn từ đầu thì không.
    extend: active && (Boolean(c.endDate) || Boolean(c.holdoverSince)),
    // Quá hạn mà chủ trọ chưa quyết định → "Cho ở tiếp, chưa ký lại".
    holdover: active && flags.includes('ExpiredAwaitingDecision'),
    // Ký lại cho người còn ở (hay dùng khi người ký đã rời đi).
    reSign: active,
    signedDocument: c.status !== 'Cancelled',
    downloadDocument: c.status !== 'Cancelled',
    notice: active,
    // Rút báo trả phòng (người thuê ở tiếp) → hóa đơn tháng lập lại như thường.
    withdrawNotice: active && Boolean(c.plannedMoveOutDate),
    // Thu tiền / bỏ nợ: hợp đồng đang hiệu lực hoặc đang thanh lý (đã kết thúc → CONTRACT_NOT_BILLABLE).
    collect: active || liquidating,
    transferRoom: active && !transferBack,
    transferBack,
    changeRepresentative: active,
    // Đổi vai trò người ở / đồng thuê: nháp hoặc đang hiệu lực. Chuyển người sang phòng khác: đang hiệu lực.
    changeOccupantRole: draft || active,
    moveOccupant: active,
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
