import { Badge, StatusBadge } from '@/components/ui'
import { INVOICE_PAYMENT_STATUS, INVOICE_STATUS } from '@/constants/enums'
import { isCarried } from '../invoiceRules'

/** Nhãn trạng thái của một phiếu (dòng danh sách hoặc `summary` của chi tiết). */
export function InvoiceBadges({ summary }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
      {summary.status === 'Finalized' && summary.paymentStatus ? (
        <StatusBadge map={INVOICE_PAYMENT_STATUS} value={summary.paymentStatus} />
      ) : (
        <StatusBadge map={INVOICE_STATUS} value={summary.status} />
      )}
      {/* Nợ đã chuyển (BL-BR-41): hiện số hóa đơn trả phòng nhận nợ. */}
      {isCarried(summary) && summary.carriedToInvoiceNo && (
        <span style={{ alignSelf: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>→ {summary.carriedToInvoiceNo}</span>
      )}
      {summary.type === 'Final' && <Badge tone="info">Trả phòng</Badge>}
      {summary.status === 'Draft' && summary.errorCount > 0 && <Badge tone="danger">Cần sửa ({summary.errorCount})</Badge>}
      {summary.status === 'Draft' && summary.isStale && <Badge tone="warning">Cần tính lại</Badge>}
      {summary.isAdjusted && <Badge tone="info">Đã điều chỉnh</Badge>}
      {summary.needsResend && <Badge tone="warning">Cần gửi lại</Badge>}
    </span>
  )
}
