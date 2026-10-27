import { formatMoney } from '@/lib/format'
import { hasSettlement, invoiceAmount } from '../invoiceRules'

/** Ô "Tổng hóa đơn" của danh sách — hóa đơn trả phòng có kết toán thêm dòng "Tổng thu" (sau nợ chuyển vào và trừ cọc — BL-BR-41). */
export function InvoiceAmountCell({ summary }) {
  return (
    <span>
      {formatMoney(invoiceAmount(summary))}
      {hasSettlement(summary) && (
        <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>Tổng thu {formatMoney(summary.totalAmount)}</span>
      )}
    </span>
  )
}
