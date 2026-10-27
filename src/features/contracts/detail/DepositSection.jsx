import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { contractsApi } from '@/api'
import { Badge, Button, ConfirmDialog, DateField, DescriptionList, FormDialog, MoneyField, Section, StatusBadge, TextAreaField } from '@/components/ui'
import { DEPOSIT_STATUS } from '@/constants/enums'
import { formatDate, formatMoney, todayVN } from '@/lib/format'

/**
 * Tiền cọc của hợp đồng (contracts.md#tiền-cọc): chỉ để theo dõi — có cọc không, bao nhiêu, đã hoàn trả chưa.
 * Không ghi tiền cọc vào / ra, không trừ cọc vào phiếu, không chặn hủy / thanh lý. Đánh dấu hoàn / không trả được ở mọi trạng thái hợp đồng.
 */
export function DepositSection({ contract: c, onDone }) {
  const [dialog, setDialog] = useState(null) // 'refund' | 'forfeit' | 'undo'
  const deposit = c.deposit
  const amount = deposit?.amount ?? c.depositAmount ?? 0
  const status = deposit?.status ?? null

  return (
    <Section
      title="Tiền cọc"
      description="Chỉ để theo dõi — tiền cọc không đi qua phiếu thu và không tự trừ vào phiếu tiền phòng."
      actions={
        <>
          {status === 'Holding' && (
            <>
              <Button size="sm" onClick={() => setDialog('refund')}>
                Đã hoàn trả cọc
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog('forfeit')}>
                Không trả cọc
              </Button>
            </>
          )}
          {(status === 'Refunded' || status === 'Forfeited') && (
            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setDialog('undo')}>
              Bỏ đánh dấu
            </Button>
          )}
        </>
      }
    >
      <DescriptionList
        items={[
          { label: 'Cọc thỏa thuận', value: amount ? formatMoney(amount) : 'Không cọc' },
          {
            label: 'Trạng thái',
            hidden: !status,
            value: (
              <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                <StatusBadge map={DEPOSIT_STATUS} value={status} />
                {deposit?.notRefundedReminder && <Badge tone="danger">Chưa hoàn cọc</Badge>}
              </span>
            ),
          },
          { label: status === 'Forfeited' ? 'Ngày quyết định' : 'Ngày hoàn', hidden: status !== 'Refunded' && status !== 'Forfeited', value: deposit?.refundedOn ? formatDate(deposit.refundedOn) : null },
          { label: 'Số tiền đã trả lại', hidden: status !== 'Refunded', value: formatMoney(deposit?.refundedAmount) },
          { label: status === 'Forfeited' ? 'Lý do không trả' : 'Ghi chú cọc', hidden: !deposit?.note, value: deposit?.note, full: true },
          { label: 'Điều kiện hoàn cọc', value: c.depositTerms, full: true },
        ]}
      />

      {dialog === 'refund' && (
        <FormDialog
          title="Đã hoàn trả cọc"
          description={`Cọc thỏa thuận ${formatMoney(amount)}. Trả ít hơn cọc (giữ lại một phần / mất cọc) thì phải ghi lý do.`}
          initial={{ refundedOn: todayVN(), amount, note: '' }}
          validate={(v) => ({
            refundedOn: !v.refundedOn ? 'Chọn ngày hoàn.' : v.refundedOn > todayVN() ? 'Ngày hoàn không ở tương lai.' : null,
            amount: v.amount !== null && (v.amount < 0 || v.amount > amount) ? `Từ 0 đến ${formatMoney(amount)}.` : null,
            note: v.amount !== null && v.amount < amount && !v.note.trim() ? 'Trả ít hơn cọc thì ghi lý do.' : null,
          })}
          codeFields={{ INVALID_REFUND_AMOUNT: 'amount', INVALID_REFUND_DATE: 'refundedOn' }}
          submitLabel="Đã hoàn trả cọc"
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await contractsApi.refundDeposit(c.id, { refundedOn: v.refundedOn, amount: v.amount, note: v.note.trim() || null })
            await onDone('Đã ghi nhận hoàn trả cọc.')
          }}
        >
          {(form) => (
            <>
              <DateField label="Ngày hoàn" required {...form.field('refundedOn')} />
              <MoneyField label="Số tiền trả lại" hint="Bỏ trống = đủ cọc; 0 = mất cọc" {...form.field('amount', { type: 'value' })} />
              <TextAreaField label="Ghi chú" rows={2} maxLength={500} placeholder="VD Giữ lại 500k sửa tường" {...form.field('note')} />
            </>
          )}
        </FormDialog>
      )}
      {dialog === 'forfeit' && (
        <FormDialog
          title="Không trả cọc"
          description={`Cọc thỏa thuận ${formatMoney(amount)} — người thuê không được nhận lại. Bắt buộc ghi lý do.`}
          initial={{ date: todayVN(), note: '' }}
          validate={(v) => ({
            date: !v.date ? 'Chọn ngày.' : v.date > todayVN() ? 'Ngày không ở tương lai.' : null,
            note: !v.note.trim() ? 'Ghi lý do không trả cọc.' : null,
          })}
          codeFields={{ REQUIRED: 'note' }}
          submitLabel="Không trả cọc"
          tone="danger"
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await contractsApi.forfeitDeposit(c.id, { date: v.date, note: v.note.trim() })
            await onDone('Đã ghi nhận không trả cọc.')
          }}
        >
          {(form) => (
            <>
              <DateField label="Ngày quyết định" required {...form.field('date')} />
              <TextAreaField label="Lý do" required rows={2} maxLength={500} placeholder="VD Trả phòng trước hạn, mất cọc theo HĐ" {...form.field('note')} />
            </>
          )}
        </FormDialog>
      )}
      <ConfirmDialog
        open={dialog === 'undo'}
        onClose={() => setDialog(null)}
        title={status === 'Forfeited' ? 'Bỏ đánh dấu không trả cọc?' : 'Bỏ đánh dấu hoàn cọc?'}
        message="Cọc của hợp đồng trở lại trạng thái Đang giữ."
        confirmLabel="Bỏ đánh dấu"
        onConfirm={async () => {
          await contractsApi.cancelDepositRefund(c.id)
          await onDone('Đã bỏ đánh dấu — cọc trở lại Đang giữ.')
        }}
      />
    </Section>
  )
}
