import { paymentsApi } from '@/api'
import { Alert, DateField, FormDialog, MoneyField, SelectField, TextAreaField, TextField, useToast } from '@/components/ui'
import { PAYMENT_METHOD_LABELS, toOptions } from '@/constants/enums'
import { PAYMENT_AFFECTED } from '@/features/shared/affected'
import { useInvalidate } from '@/hooks/useAction'
import { blankToNull } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { formatMoney, todayVN } from '@/lib/format'

const paidAtError = (date) => (!date ? 'Chọn ngày thu.' : date > todayVN() ? 'Ngày thu không ở tương lai.' : null)
const PAYMENT_CODE_FIELDS = { PAYMENT_EXCEEDS_DEBT: 'amount', INVALID_PAID_AT: 'paidAt', NOTHING_TO_WRITE_OFF: 'amount' }

function MoneyReceivedFields({ form }) {
  return (
    <>
      <SelectField label="Hình thức" options={toOptions(PAYMENT_METHOD_LABELS)} {...form.field('method')} />
      <DateField label="Ngày thu" required {...form.field('paidAt')} />
      <TextField label="Người nộp" maxLength={200} {...form.field('payerName')} />
      {form.values.method !== 'Cash' && <TextField label="Mã giao dịch" maxLength={100} {...form.field('reference')} />}
    </>
  )
}

/**
 * Ghi thu ("Đã thu") — payments.md#ghi-thu.
 *  - Có `invoice` (summary): thu cho đúng phiếu đó, mặc định đủ số còn nợ, sửa được nếu thu một phần.
 *  - Không có `invoice`: thu theo hợp đồng, tự trừ phiếu cũ nhất trước; `maxAmount` = tổng nợ của hợp đồng.
 * Chưa hỗ trợ trả thừa: nhập hơn số còn nợ → 422 PAYMENT_EXCEEDS_DEBT.
 */
export function RecordPaymentDialog({ contractId, contractNo, invoice, maxAmount, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  return (
    <FormDialog
      title={invoice ? `Đã thu — phiếu ${invoice.invoiceNo}` : `Thu theo hợp đồng ${contractNo ?? ''}`}
      description={invoice ? `Còn nợ ${formatMoney(maxAmount)}. Thu một phần thì phần còn lại vẫn là nợ.` : `Tổng còn nợ ${formatMoney(maxAmount)} — tiền được trừ vào phiếu cũ nhất trước.`}
      initial={{ amount: maxAmount, method: 'Cash', paidAt: todayVN(), payerName: '', reference: '', note: '' }}
      validate={(v) => ({
        amount: v.amount === null || v.amount <= 0 ? 'Nhập số tiền lớn hơn 0.' : v.amount > maxAmount ? `Không lớn hơn số còn nợ ${formatMoney(maxAmount)}.` : null,
        paidAt: paidAtError(v.paidAt),
      })}
      codeFields={PAYMENT_CODE_FIELDS}
      submitLabel="Ghi thu"
      onClose={onClose}
      onSubmit={async (v) => {
        const body = {
          amount: v.amount,
          method: v.method,
          paidAt: v.paidAt,
          invoiceId: invoice?.id ?? null,
          payerName: blankToNull(v.payerName),
          reference: v.method === 'Cash' ? null : blankToNull(v.reference),
          note: blankToNull(v.note),
        }
        const payment = await paymentsApi.record(contractId, body, { idempotencyKey: idem.keyFor(body) })
        idem.reset()
        await invalidate(...PAYMENT_AFFECTED)
        toast.success(`Đã ghi thu ${formatMoney(payment.amount)} — phiếu thu ${payment.receiptNo}.`)
      }}
    >
      {(form) => (
        <>
          <MoneyField label="Số tiền thu" required {...form.field('amount', { type: 'value' })} />
          <MoneyReceivedFields form={form} />
          <TextField label="Ghi chú" maxLength={500} {...form.field('note')} />
        </>
      )}
    </FormDialog>
  )
}

/**
 * "Thanh toán + bỏ phần còn lại" trên một phiếu (payments.md#trả-dần-và-bỏ-nợ): thu số thực trả, phần còn lại bỏ nợ — không tính doanh thu.
 * Số trả phải nhỏ hơn số còn nợ (bằng thì dùng "Đã thu"). Cần quyền bỏ nợ.
 */
export function PayAndWriteOffDialog({ invoice, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const debt = invoice.outstanding
  return (
    <FormDialog
      title={`Thanh toán + bỏ phần còn lại — ${invoice.invoiceNo}`}
      description={`Còn nợ ${formatMoney(debt)}. Phần không thu được đóng nợ luôn và không tính doanh thu.`}
      initial={{ amount: null, method: 'Cash', paidAt: todayVN(), payerName: '', reference: '', reason: '' }}
      validate={(v) => ({
        amount: v.amount === null || v.amount <= 0 ? 'Nhập số tiền thực thu.' : v.amount >= debt ? `Phải nhỏ hơn số còn nợ ${formatMoney(debt)} — thu đủ thì dùng “Đã thu”.` : null,
        paidAt: paidAtError(v.paidAt),
        reason: !v.reason.trim() ? 'Nhập lý do bỏ phần còn lại.' : null,
      })}
      codeFields={PAYMENT_CODE_FIELDS}
      submitLabel="Ghi thu và bỏ phần còn lại"
      tone="danger"
      onClose={onClose}
      onSubmit={async (v) => {
        const body = {
          amount: v.amount,
          method: v.method,
          paidAt: v.paidAt,
          payerName: blankToNull(v.payerName),
          reference: v.method === 'Cash' ? null : blankToNull(v.reference),
          reason: v.reason.trim(),
        }
        const result = await paymentsApi.payAndWriteOff(invoice.id, body, { idempotencyKey: idem.keyFor(body) })
        idem.reset()
        await invalidate(...PAYMENT_AFFECTED)
        toast.success(`Đã thu ${formatMoney(result.payment.amount)} và bỏ nợ ${formatMoney(result.writeOff.amount)}.`)
      }}
    >
      {(form) => (
        <>
          <MoneyField
            label="Số tiền thực thu"
            required
            hint={form.values.amount > 0 && form.values.amount < debt ? `Bỏ nợ phần còn lại: ${formatMoney(debt - form.values.amount)}` : undefined}
            {...form.field('amount', { type: 'value' })}
          />
          <MoneyReceivedFields form={form} />
          <TextAreaField label="Lý do bỏ phần còn lại" required rows={2} maxLength={500} placeholder="VD Khó khăn, chủ trọ cho 1 triệu" {...form.field('reason')} />
        </>
      )}
    </FormDialog>
  )
}

/** Bỏ nợ riêng một phần / toàn bộ số còn nợ của phiếu — không thu tiền, không tính doanh thu, đảo được như phiếu thu thường. Cần quyền bỏ nợ. */
export function WriteOffDialog({ invoice, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const debt = invoice.outstanding
  return (
    <FormDialog
      title={`Bỏ nợ phiếu ${invoice.invoiceNo}?`}
      initial={{ amount: null, reason: '' }}
      validate={(v) => ({
        amount: v.amount !== null && (v.amount <= 0 || v.amount > debt) ? `Từ 1 đ đến số còn nợ ${formatMoney(debt)}.` : null,
        reason: !v.reason.trim() ? 'Nhập lý do bỏ nợ.' : null,
      })}
      codeFields={PAYMENT_CODE_FIELDS}
      submitLabel="Bỏ nợ"
      tone="danger"
      onClose={onClose}
      onSubmit={async (v) => {
        const body = { amount: v.amount, reason: v.reason.trim() }
        const writeOff = await paymentsApi.writeOff(invoice.id, body, { idempotencyKey: idem.keyFor(body) })
        idem.reset()
        await invalidate(...PAYMENT_AFFECTED)
        toast.success(`Đã bỏ nợ ${formatMoney(writeOff.amount)}.`)
      }}
    >
      {(form) => (
        <>
          <Alert tone="warning">Bỏ nợ đóng công nợ mà không thu tiền — số này không tính vào doanh thu. Nhập nhầm thì đảo phiếu bỏ nợ ở lịch sử thu.</Alert>
          <MoneyField label="Số tiền bỏ" hint={`Bỏ trống = toàn bộ số còn nợ ${formatMoney(debt)}`} {...form.field('amount', { type: 'value' })} />
          <TextAreaField label="Lý do bỏ nợ" required rows={2} maxLength={500} {...form.field('reason')} />
        </>
      )}
    </FormDialog>
  )
}
