import { Ban, Check, Lock, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { roomChargesApi } from '@/api'
import { Badge, Button, ConfirmDialog, DataTable, DateField, FormDialog, SelectField, StatusBadge, useToast } from '@/components/ui'
import { PAYMENT_METHOD_LABELS, ROOM_CHARGE_KIND_LABELS, ROOM_CHARGE_STATUS, toOptions } from '@/constants/enums'
import { CHARGE_AFFECTED } from '@/features/shared/affected'
import { useAction, useInvalidate } from '@/hooks/useAction'
import { formatBillingMonth, formatDate, formatMoney, todayVN } from '@/lib/format'

/** Còn đánh dấu / hủy được: chưa nằm trên phiếu đã chốt và chưa hủy (422 ROOM_CHARGE_LOCKED / ROOM_CHARGE_CANCELLED). */
const isOpen = (c) => c.status === 'Pending' || c.status === 'OnDraft'

/**
 * Bảng khoản phát sinh + thao tác theo trạng thái (docs/api/room-charges.md#cấu-trúc-trả-về):
 *  - Chờ lên phiếu / trên phiếu nháp: đánh dấu hoặc bỏ đánh dấu "đã thanh toán", hủy (không có lệnh sửa — sai thì hủy rồi tạo lại).
 *  - Đã vào phiếu đã chốt / đã hủy: chỉ xem.
 *  - Khoản hệ thống (chốt điện nước khi chuyển phòng): chỉ đánh dấu đã thu, không hủy tay.
 */
export function RoomChargeList({ charges, showRoom = false }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const [dialog, setDialog] = useState(null) // { type: 'settle' | 'unsettle' | 'cancel', charge }
  const close = () => setDialog(null)
  const unsettle = useAction({ mutationFn: (id) => roomChargesApi.unsettle(id), invalidate: CHARGE_AFFECTED, success: 'Đã bỏ đánh dấu đã thanh toán.', toastErrors: false })
  const cancel = useAction({ mutationFn: ({ id, reason }) => roomChargesApi.cancel(id, reason), invalidate: CHARGE_AFFECTED, success: 'Đã hủy khoản phát sinh.', toastErrors: false })
  const waive = useAction({ mutationFn: (id) => roomChargesApi.waive(id), invalidate: CHARGE_AFFECTED, success: 'Đã ghi nhận không trả lại — khoản đã hủy.', toastErrors: false })
  const charge = dialog?.charge

  const columns = [
    {
      key: 'description',
      header: 'Nội dung',
      primary: true,
      cell: (c) => (
        <div style={c.status === 'Cancelled' ? { textDecoration: 'line-through', color: 'var(--color-text-muted)' } : undefined}>
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {c.isSystem && <Lock size={14} aria-label="Khoản hệ thống" />}
            <strong>{c.description}</strong>
            <Badge tone={c.kind === 'Surcharge' ? 'orange' : 'info'}>{ROOM_CHARGE_KIND_LABELS[c.kind] ?? c.kind}</Badge>
          </span>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{c.status === 'Cancelled' && c.cancelReason ? `Hủy: ${c.cancelReason}` : c.reason}</div>
        </div>
      ),
    },
    ...(showRoom ? [{ key: 'room', header: 'Phòng', cell: (c) => <Link to={`/rooms/${c.roomId}`}>{c.roomCode}</Link> }] : []),
    { key: 'date', header: 'Ngày phát sinh', cell: (c) => formatDate(c.incurredOn) },
    { key: 'amount', header: 'Số tiền', align: 'right', cell: (c) => `${c.kind === 'Credit' ? '−' : ''}${formatMoney(c.amount)}` },
    {
      key: 'settled',
      header: 'Thanh toán',
      cell: (c) =>
        c.isSettled ? (
          <span>
            <Badge tone="success">{c.kind === 'Surcharge' ? 'Đã thu ngay' : 'Đã trả ngay'}</Badge>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
              {formatDate(c.settledOn)}
              {c.settledMethod ? ` · ${PAYMENT_METHOD_LABELS[c.settledMethod] ?? c.settledMethod}` : ''}
            </div>
          </span>
        ) : c.kind === 'Surcharge' ? (
          'Cộng vào phiếu'
        ) : (
          'Trừ vào phiếu'
        ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (c) => (
        <span>
          <StatusBadge map={ROOM_CHARGE_STATUS} value={c.status} />
          {c.invoiceId && (
            <div style={{ fontSize: 'var(--text-xs)' }}>
              <Link to={`/invoices/${c.invoiceId}`}>{c.invoiceNo ?? `Nháp ${c.billingMonth ? formatBillingMonth(c.billingMonth).toLowerCase() : ''}`}</Link>
            </div>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      cell: (c) =>
        isOpen(c) ? (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
            {c.isSystem && c.status === 'Pending' && !c.isSettled && c.description.startsWith('Chênh lệch sau thanh lý') && (
              <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'waive', charge: c })}>
                Không trả lại
              </Button>
            )}
            {c.isSettled ? (
              <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setDialog({ type: 'unsettle', charge: c })}>
                Bỏ đánh dấu
              </Button>
            ) : (
              <Button size="sm" variant="secondary" icon={Check} onClick={() => setDialog({ type: 'settle', charge: c })}>
                {c.kind === 'Surcharge' ? 'Đã thu' : 'Đã trả'}
              </Button>
            )}
            {!c.isSystem && (
              <Button size="sm" variant="ghost" icon={Ban} onClick={() => setDialog({ type: 'cancel', charge: c })}>
                Hủy
              </Button>
            )}
          </span>
        ) : null,
    },
  ]

  return (
    <>
      <DataTable columns={columns} rows={charges} caption="Khoản phát sinh" />
      {dialog?.type === 'settle' && (
        <FormDialog
          title={charge.kind === 'Surcharge' ? 'Người thuê đã trả khoản này?' : 'Đã trả khoản này cho người thuê?'}
          description={`${charge.description} — ${formatMoney(charge.amount)}. Khoản vẫn hiện trên phiếu nhưng không tính vào tổng.`}
          initial={{ settledOn: todayVN(), method: 'Cash' }}
          validate={(v) => ({ settledOn: !v.settledOn ? 'Chọn ngày.' : v.settledOn > todayVN() ? 'Ngày không ở tương lai.' : null })}
          codeFields={{ INVALID_SETTLED_DATE: 'settledOn' }}
          submitLabel="Đánh dấu đã thanh toán"
          onClose={close}
          onSubmit={async (v) => {
            await roomChargesApi.settle(charge.id, { settledOn: v.settledOn, method: v.method })
            await invalidate(...CHARGE_AFFECTED)
            toast.success('Đã đánh dấu đã thanh toán.')
          }}
        >
          {(form) => (
            <>
              <DateField label="Ngày thanh toán" required {...form.field('settledOn')} />
              <SelectField label="Hình thức" options={toOptions(PAYMENT_METHOD_LABELS)} {...form.field('method')} />
            </>
          )}
        </FormDialog>
      )}
      <ConfirmDialog
        open={dialog?.type === 'waive'}
        onClose={close}
        title="Không trả lại khoản này?"
        message={charge ? `"${charge.description}" ${formatMoney(charge.amount)} sẽ được hủy (lý do “Không trả lại”), báo cáo không đổi. Chọn “Đã trả” nếu đã trả lại người thuê.` : ''}
        confirmLabel="Không trả lại"
        onConfirm={() => waive.mutateAsync(charge.id)}
      />
      <ConfirmDialog
        open={dialog?.type === 'unsettle'}
        onClose={close}
        title="Bỏ đánh dấu đã thanh toán?"
        message={
          charge?.kind === 'Credit'
            ? 'Khoản bù quay lại chờ trừ vào phiếu. Tổng các khoản bù chưa trả của hợp đồng không được vượt một tháng tiền phòng.'
            : 'Khoản phụ thu quay lại cộng vào phiếu tiền phòng.'
        }
        confirmLabel="Bỏ đánh dấu"
        onConfirm={() => unsettle.mutateAsync(charge.id)}
      />
      <ConfirmDialog
        open={dialog?.type === 'cancel'}
        onClose={close}
        title="Hủy khoản phát sinh?"
        message={charge ? `"${charge.description}" ${formatMoney(charge.amount)} sẽ bị hủy${charge.status === 'OnDraft' ? ' và dòng tương ứng trên phiếu nháp bị xóa' : ''}.` : ''}
        reasonLabel="Lý do hủy"
        reasonMaxLength={300}
        confirmLabel="Hủy khoản"
        tone="danger"
        onConfirm={(reason) => cancel.mutateAsync({ id: charge.id, reason })}
      />
    </>
  )
}
