// Quy tắc hiển thị phiếu tiền phòng (docs/api/invoices.md).
import { INVOICE_LINE_TYPE_LABELS, SETTLEMENT_LINE_TYPES } from '@/constants/enums'
import { formatBillingMonth, formatDate } from '@/lib/format'

export const LINE_GROUP_ORDER = Object.keys(INVOICE_LINE_TYPE_LABELS)
export const MANUAL_LINE_TYPES = new Set(['Surcharge', 'ManualDiscount', 'Refund'])
export const MAX_LINE_AMOUNT = 100_000_000 // khớp giới hạn dòng nhập tay của backend

export const isDraft = (summary) => summary.status === 'Draft'
export const isFinalized = (summary) => summary.status === 'Finalized'

/** Chốt được: nháp không còn vấn đề chặn (thiếu chỉ số, thiếu giá, tổng âm…). */
export const canFinalize = (summary) => isDraft(summary) && summary.errorCount === 0

/** Hủy phiếu đã chốt: chỉ khi chưa thu tiền và chưa xác nhận hoàn tiền (server còn kiểm "phiếu mới nhất của hợp đồng", HĐ chưa kết thúc). */
export const canVoid = (summary) => isFinalized(summary) && summary.paidAmount === 0 && !['Refunded', 'RefundWaived'].includes(summary.paymentStatus)

/** Tổng hóa đơn (tiền của chính kỳ đó) — khác Tổng thu (`totalAmount`) chỉ ở hóa đơn trả phòng có kết toán (BL-BR-41). */
export const invoiceAmount = (summary) => summary.invoiceAmount ?? summary.totalAmount
export const hasSettlement = (summary) => invoiceAmount(summary) !== summary.totalAmount

/** Nợ của phiếu đã chuyển vào hóa đơn trả phòng — trạng thái đi theo hóa đơn trả phòng. */
export const isCarried = (summary) => summary.paymentStatus?.startsWith('Carried') ?? false

export const settlementLines = (lines) => lines.filter((l) => SETTLEMENT_LINE_TYPES.has(l.type))

export const invoiceTitle = (summary) => (summary.invoiceNo ? `Phiếu ${summary.invoiceNo}` : summary.type === 'Final' ? 'Hóa đơn trả phòng (nháp)' : 'Phiếu nháp')

export const periodLabel = (summary) => `${formatBillingMonth(summary.billingMonth)} · ${formatDate(summary.periodStart)} – ${formatDate(summary.periodEnd)}`

/** Nhóm dòng theo loại, giữ thứ tự Tiền phòng → Điện nước → Dịch vụ → Phụ thu → Giảm trừ → Hoàn trả. */
export function groupLines(lines) {
  return LINE_GROUP_ORDER.map((type) => ({ type, label: INVOICE_LINE_TYPE_LABELS[type], lines: lines.filter((l) => l.type === type) })).filter((g) => g.lines.length > 0)
}

/** Tóm tắt một lệnh trả kết quả từng phần để hiện thành bảng "phòng nào được, phòng nào lỗi". */
export const countFailed = (rows) => rows.filter((r) => !r.ok).length
