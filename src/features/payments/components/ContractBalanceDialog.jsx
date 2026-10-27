import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { paymentsApi, queryKeys } from '@/api'
import { Alert, Badge, Button, DataTable, DescriptionList, EmptyState, Modal, QueryView } from '@/components/ui'
import { INVOICE_TYPE_LABELS } from '@/constants/enums'
import { formatBillingMonth, formatDate, formatMoney } from '@/lib/format'
import { RecordPaymentDialog } from './PaymentDialogs'

// Chỉ ghi thu cho hợp đồng đang hiệu lực / đang thanh lý (hợp đồng đã kết thúc → 422 CONTRACT_NOT_BILLABLE).
const BILLABLE = new Set(['Active', 'Liquidating'])

/**
 * Thu theo hợp đồng (payments.md#số-nợ-của-hợp-đồng): tổng còn nợ, phần quá hạn, từng phiếu còn nợ (cũ trước).
 * "Thu tất cả / thu một phần" không chỉ định phiếu → tiền trừ vào phiếu cũ nhất trước; mỗi dòng có "Đã thu" cho riêng phiếu đó.
 */
export function ContractBalanceDialog({ contractId, onClose }) {
  const [paying, setPaying] = useState(null) // null | { invoice? }
  const query = useQuery({
    queryKey: queryKeys.payments.balance(contractId),
    queryFn: ({ signal }) => paymentsApi.balance(contractId, { signal }),
  })
  const balance = query.data
  const billable = balance && BILLABLE.has(balance.status)

  const columns = [
    {
      key: 'invoice',
      header: 'Phiếu',
      primary: true,
      cell: (i) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <Link to={`/invoices/${i.invoiceId}`} onClick={onClose}>
            <strong>{i.invoiceNo}</strong>
          </Link>
          {i.type === 'Final' && <Badge tone="info">{INVOICE_TYPE_LABELS.Final}</Badge>}
          {i.isOverdue && <Badge tone="danger">Quá hạn</Badge>}
        </span>
      ),
    },
    { key: 'month', header: 'Kỳ', cell: (i) => formatBillingMonth(i.billingMonth) },
    { key: 'due', header: 'Hạn', hideOnMobile: true, cell: (i) => (i.dueDate ? formatDate(i.dueDate) : '—') },
    // "Đã thu" = thực thu (collectedAmount); paidAmount = thực thu + bỏ nợ (payments.md#số-nợ-của-hợp-đồng).
    { key: 'paid', header: 'Đã thu', align: 'right', hideOnMobile: true, cell: (i) => `${formatMoney(i.collectedAmount ?? i.paidAmount)} / ${formatMoney(i.totalAmount)}` },
    { key: 'writtenOff', header: 'Đã bỏ nợ', align: 'right', hideOnMobile: true, cell: (i) => (i.writtenOffAmount > 0 ? formatMoney(i.writtenOffAmount) : '—') },
    { key: 'outstanding', header: 'Còn nợ', align: 'right', cell: (i) => <strong>{formatMoney(i.outstanding)}</strong> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (i) =>
        billable ? (
          <Button size="sm" variant="secondary" onClick={() => setPaying({ invoice: { id: i.invoiceId, invoiceNo: i.invoiceNo, outstanding: i.outstanding } })}>
            Đã thu
          </Button>
        ) : null,
    },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title={balance ? `Hợp đồng ${balance.contractNo} — còn nợ ${formatMoney(balance.outstanding)}` : 'Số nợ của hợp đồng'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          {billable && balance.outstanding > 0 && <Button onClick={() => setPaying({})}>Thu theo hợp đồng</Button>}
        </>
      }
    >
      <QueryView query={query} loading="page" errorTitle="Không tải được số nợ của hợp đồng">
        {() => (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <DescriptionList
              items={[
                { label: 'Tổng còn nợ', value: formatMoney(balance.outstanding) },
                { label: 'Trong đó quá hạn', value: balance.overdueAmount > 0 ? <span style={{ color: 'var(--color-danger)' }}>{formatMoney(balance.overdueAmount)}</span> : formatMoney(0) },
                { label: 'Phải trả lại người thuê', hidden: !balance.refundDue, value: `${formatMoney(balance.refundDue)} (không bù trừ vào nợ)` },
              ]}
            />
            {(balance.draftInvoices > 0 || balance.pendingRoomCharges > 0) && (
              <Alert tone="info">
                {balance.draftInvoices > 0 && `Còn ${balance.draftInvoices} phiếu nháp chưa chốt — chưa tính vào nợ. `}
                {balance.pendingRoomCharges > 0 && `Có ${balance.pendingRoomCharges} khoản phát sinh chưa lên phiếu.`}
              </Alert>
            )}
            {!billable && balance.outstanding > 0 && <Alert tone="warning">Hợp đồng đã kết thúc — không ghi thu thêm được.</Alert>}
            {balance.unpaidInvoices.length === 0 ? (
              <EmptyState title="Không còn phiếu nào chưa thu đủ" />
            ) : (
              <DataTable columns={columns} rows={balance.unpaidInvoices} rowKey={(i) => i.invoiceId} caption="Phiếu còn nợ" />
            )}
          </div>
        )}
      </QueryView>
      {paying && (
        <RecordPaymentDialog
          contractId={contractId}
          contractNo={balance.contractNo}
          invoice={paying.invoice}
          maxAmount={paying.invoice ? paying.invoice.outstanding : balance.outstanding}
          onClose={() => setPaying(null)}
        />
      )}
    </Modal>
  )
}
