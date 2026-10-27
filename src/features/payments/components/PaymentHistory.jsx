import { useQuery } from '@tanstack/react-query'
import { Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { paymentsApi, queryKeys } from '@/api'
import { Badge, Button, ConfirmDialog, DataTable, EmptyState, QueryView } from '@/components/ui'
import { PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS } from '@/constants/enums'
import { PAYMENT_AFFECTED } from '@/features/shared/affected'
import { useAction } from '@/hooks/useAction'
import { formatDate, formatMoney } from '@/lib/format'

/**
 * Lịch sử thu của một phiếu / hợp đồng / phòng (payments.md: GET /payments — mảng, mới nhất trước).
 * Không sửa / xóa phiếu thu: nhập sai thì đảo (lý do bắt buộc) rồi ghi lại. Phiếu thu đã đảo gạch ngang.
 * Phiếu hoàn tiền (kind Refund, số PC…) do hệ thống tạo khi điều chỉnh chỉ số "Xử lý ngay" — đảo được như phiếu thu.
 * filter: { invoiceId } | { contractId } | { roomId }
 */
export function PaymentHistory({ filter, emptyTitle = 'Chưa có lần thu nào' }) {
  const [reversing, setReversing] = useState(null)
  const query = useQuery({
    queryKey: queryKeys.payments.list(filter),
    queryFn: ({ signal }) => paymentsApi.list(filter, { signal }),
  })
  const reverse = useAction({
    mutationFn: ({ id, reason }) => paymentsApi.reverse(id, reason),
    invalidate: PAYMENT_AFFECTED,
    success: 'Đã đảo phiếu thu — phiếu tiền phòng trở lại còn nợ.',
    toastErrors: false,
  })

  const columns = [
    {
      key: 'receipt',
      header: 'Phiếu thu',
      primary: true,
      cell: (p) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <strong style={p.status === 'Reversed' ? { textDecoration: 'line-through', color: 'var(--color-text-muted)' } : undefined}>{p.receiptNo}</strong>
          {p.kind === 'WriteOff' && <Badge tone="dark">{PAYMENT_KIND_LABELS.WriteOff}</Badge>}
          {p.kind === 'Refund' && <Badge tone="info">{PAYMENT_KIND_LABELS.Refund}</Badge>}
          {p.status === 'Reversed' && <Badge>Đã đảo</Badge>}
        </span>
      ),
    },
    { key: 'date', header: 'Ngày thu', cell: (p) => formatDate(p.paidAt) },
    // Phiếu hoàn tiền: tiền chủ trọ trả lại người thuê ⇒ hiện số âm.
    { key: 'amount', header: 'Số tiền', align: 'right', cell: (p) => (p.kind === 'Refund' ? `−${formatMoney(p.amount)}` : formatMoney(p.amount)) },
    {
      key: 'method',
      header: 'Hình thức',
      cell: (p) => (p.kind === 'WriteOff' ? '—' : `${PAYMENT_METHOD_LABELS[p.method] ?? p.method}${p.reference ? ` · ${p.reference}` : ''}`),
    },
    {
      key: 'allocations',
      header: 'Trừ vào phiếu',
      cell: (p) =>
        p.allocations.length === 0
          ? '—'
          : p.allocations.map((a, index) => (
              <span key={a.invoiceId}>
                {index > 0 && ', '}
                <Link to={`/invoices/${a.invoiceId}`}>{a.invoiceNo}</Link> ({formatMoney(a.amount)})
              </span>
            )),
    },
    { key: 'note', header: 'Ghi chú', hideOnMobile: true, cell: (p) => (p.status === 'Reversed' ? `Đảo: ${p.reverseReason ?? ''}` : (p.note ?? p.payerName ?? '—')) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) =>
        p.status === 'Recorded' ? (
          <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setReversing(p)}>
            Đảo
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <QueryView query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title={emptyTitle} />} errorTitle="Không tải được lịch sử thu">
        {(payments) => <DataTable columns={columns} rows={payments} caption="Lịch sử thu" />}
      </QueryView>
      <ConfirmDialog
        open={Boolean(reversing)}
        onClose={() => setReversing(null)}
        title={`Đảo phiếu thu ${reversing?.receiptNo ?? ''}?`}
        message={reversing ? `${formatMoney(reversing.amount)} sẽ được gỡ khỏi các phiếu tiền phòng đã trừ — các phiếu đó trở lại còn nợ. Phiếu thu không xóa được, chỉ đánh dấu đã đảo.` : ''}
        reasonLabel="Lý do đảo"
        reasonMaxLength={500}
        confirmLabel="Đảo phiếu thu"
        tone="danger"
        onConfirm={(reason) => reverse.mutateAsync({ id: reversing.id, reason })}
      />
    </>
  )
}
