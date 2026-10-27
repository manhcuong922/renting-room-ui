import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { invoicesApi, queryKeys } from '@/api'
import { Alert, CheckboxField, CheckboxGroup, DateField, FormDialog, MoneyField, NumberField, RadioGroup, SelectField, TextAreaField, TextField, useToast } from '@/components/ui'
import { PAYMENT_METHOD_LABELS, toOptions } from '@/constants/enums'
import { usePropertyFees, usePropertyRooms } from '@/features/shared/queries'
import { useInvalidate } from '@/hooks/useAction'
import { blankToNull } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { formatBillingMonth, formatMoney, todayVN } from '@/lib/format'
import { MAX_LINE_AMOUNT } from '../invoiceRules'
import { BulkResultDialog } from './BulkResultDialog'

const TYPE_OPTIONS = [
  { value: 'Surcharge', label: 'Phụ thu' },
  { value: 'ManualDiscount', label: 'Giảm trừ' },
  { value: 'Refund', label: 'Hoàn trả' },
]
const amountError = (amount) => (amount === null ? 'Nhập số tiền.' : amount <= 0 ? 'Số tiền lớn hơn 0.' : amount > MAX_LINE_AMOUNT ? `Tối đa ${formatMoney(MAX_LINE_AMOUNT)}.` : null)

/** "Đã thanh toán / đã trả ngay": dòng hiện trên phiếu nhưng không tính vào tổng (room-charges.md). */
function SettledFields({ form, type }) {
  return (
    <>
      <CheckboxField
        label={type === 'Surcharge' ? 'Người thuê đã trả ngay' : 'Đã trả cho người thuê ngay'}
        description="Vẫn hiện trên phiếu cho đầy đủ nhưng không tính vào tổng."
        {...form.field('settled', { type: 'checkbox' })}
      />
      {form.values.settled && (
        <>
          <DateField label="Ngày thanh toán" hint="Bỏ trống = hôm nay" {...form.field('settledOn')} />
          <SelectField label="Hình thức" options={toOptions(PAYMENT_METHOD_LABELS)} {...form.field('method')} />
        </>
      )}
    </>
  )
}

const LINE_DEFAULTS = { byQuantity: false, quantity: null, unitPrice: null, feeTypeId: '' }
/** Thành tiền của dòng: nhập thẳng, hoặc số lượng × đơn giá (làm tròn tới đồng). */
const lineAmount = (v) => (v.byQuantity ? (v.quantity !== null && v.unitPrice !== null ? Math.round(v.quantity * v.unitPrice) : null) : v.amount)
const quantityErrors = (v) =>
  v.byQuantity
    ? {
        quantity: v.quantity === null || v.quantity <= 0 ? 'Số lượng lớn hơn 0.' : null,
        unitPrice: v.unitPrice === null || v.unitPrice < 0 ? 'Đơn giá từ 0.' : null,
      }
    : {}
const linePricing = (v) => ({
  quantity: v.byQuantity ? v.quantity : null,
  unitPrice: v.byQuantity ? v.unitPrice : null,
  amount: lineAmount(v),
  feeTypeId: v.feeTypeId || null,
})

/** Số tiền: nhập thẳng hoặc tính từ số lượng × đơn giá; tùy chọn gắn với một khoản thu của khu (để báo cáo không lẫn vào phụ thu chung). */
function AmountFields({ form, propertyId, amountLabel = 'Số tiền', hint }) {
  const fees = usePropertyFees(propertyId)
  const v = form.values
  return (
    <>
      <CheckboxField label="Nhập theo số lượng × đơn giá" {...form.field('byQuantity', { type: 'checkbox' })} />
      {v.byQuantity ? (
        <>
          <NumberField label="Số lượng" required decimals={2} {...form.field('quantity', { type: 'value' })} />
          <NumberField label="Đơn giá" required decimals={2} suffix="đ" hint={lineAmount(v) !== null ? `Thành tiền: ${formatMoney(lineAmount(v))}` : undefined} {...form.field('unitPrice', { type: 'value' })} error={form.errors.unitPrice ?? form.errors.amount} />
        </>
      ) : (
        <MoneyField label={amountLabel} required hint={hint} {...form.field('amount', { type: 'value' })} />
      )}
      {(fees.data ?? []).length > 0 && (
        <SelectField
          label="Gắn với khoản thu"
          placeholder="Không gắn"
          options={fees.data.map((f) => ({ value: f.id, label: f.name }))}
          {...form.field('feeTypeId')}
        />
      )}
    </>
  )
}

const settlement = (v) => (v.settled ? { settled: true, settledOn: v.settledOn || null, method: v.method } : { settled: false, settledOn: null, method: null })

/**
 * Thêm phụ thu / giảm trừ / hoàn trả vào một phiếu nháp (invoices.md#sửa-phiếu-nháp).
 * Hoàn trả: chỉ khi phiếu đã chốt bị tính sai mà người thuê đã trả — bắt buộc chọn phiếu nguồn; số tiền ≤ số đã thu thật của phiếu đó.
 * `preset`: điền sẵn (VD nút "Thêm hoàn trả" của cảnh báo RENT_OVERPAID — { type: 'Refund', amount, sourceInvoiceId }).
 */
export function AddLineDialog({ invoice, preset, onSaved, onClose }) {
  const toast = useToast()
  const { summary } = invoice
  // Phiếu nguồn của dòng hoàn trả: phiếu đã chốt của cùng hợp đồng.
  const sources = useQuery({
    queryKey: queryKeys.invoices.list({ contractId: summary.contractId, status: 'Finalized', pageSize: 100 }),
    queryFn: ({ signal }) => invoicesApi.list({ contractId: summary.contractId, status: 'Finalized', page: 1, pageSize: 100 }, { signal }),
  })
  const sourceOptions = (sources.data?.items ?? [])
    // Hoàn được tối đa số người thuê trả thật (collectedAmount — không tính phần bỏ nợ).
    .filter((i) => i.id !== summary.id && (i.collectedAmount ?? i.paidAmount) > 0)
    .map((i) => ({ value: i.id, label: `${i.invoiceNo} — ${formatBillingMonth(i.billingMonth)} · đã thu ${formatMoney(i.collectedAmount ?? i.paidAmount)}` }))

  return (
    <FormDialog
      title="Thêm dòng vào phiếu"
      initial={{ type: 'Surcharge', description: '', amount: null, note: '', sourceInvoiceId: '', settled: false, settledOn: '', method: 'Cash', ...LINE_DEFAULTS, ...preset }}
      validate={(v) => ({
        description: !v.description.trim() ? 'Nhập nội dung.' : null,
        ...quantityErrors(v),
        amount: v.byQuantity && lineAmount(v) === null ? null : amountError(lineAmount(v)),
        note: !v.note.trim() ? 'Nhập lý do.' : null,
        sourceInvoiceId: v.type === 'Refund' && !v.sourceInvoiceId ? 'Chọn phiếu đã thu cần hoàn.' : null,
      })}
      codeFields={{ NOTE_REQUIRED: 'note', NEGATIVE_TOTAL: 'amount', REFUND_SOURCE_INVALID: 'sourceInvoiceId', REFUND_SOURCE_REQUIRED: 'sourceInvoiceId', ROOM_CHARGE_CREDIT_TOO_HIGH: 'amount' }}
      submitLabel="Thêm"
      onClose={onClose}
      onSubmit={async (v, form) => {
        const refund = v.type === 'Refund'
        try {
          const detail = await invoicesApi.addManualLine(summary.id, {
            type: v.type,
            description: v.description.trim(),
            ...linePricing(v),
            note: v.note.trim(),
            ...(refund ? { sourceInvoiceId: v.sourceInvoiceId } : settlement(v)),
          })
          onSaved(detail)
          toast.success('Đã thêm dòng vào phiếu.')
          return true
        } catch (error) {
          // Hoàn trả vượt số đã thu thật của phiếu nguồn: body có `available`.
          if (error.code === 'REFUND_EXCEEDS_PAID') {
            const available = error.extensions?.available
            const message = available !== undefined ? `Chỉ còn hoàn được tối đa ${formatMoney(available)} từ phiếu này.` : error.detail
            form.setErrors({ amount: message })
            form.setFormError(null)
            toast.error(message)
            return false
          }
          throw error
        }
      }}
    >
      {(form) => {
        const { type } = form.values
        return (
          <>
            <RadioGroup label="Loại" options={TYPE_OPTIONS} value={type} onChange={(value) => form.setValue('type', value)} />
            {type === 'Refund' && (
              <>
                <Alert tone="info">Hoàn trả chỉ dùng khi phiếu đã chốt bị tính sai mà người thuê đã trả (VD trả phòng sớm đã thu trọn tiền phòng). Phiếu chưa thu mà tính sai thì bỏ nợ phần sai.</Alert>
                <SelectField
                  label="Hoàn từ phiếu"
                  required
                  placeholder={sources.isPending ? 'Đang tải…' : sourceOptions.length ? 'Chọn phiếu đã thu…' : 'Hợp đồng chưa có phiếu nào đã thu'}
                  options={sourceOptions}
                  {...form.field('sourceInvoiceId')}
                />
              </>
            )}
            <TextField label="Nội dung" required maxLength={200} placeholder={type === 'Surcharge' ? 'VD Thay khóa cửa' : type === 'Refund' ? 'VD Hoàn tiền phòng 15 ngày chưa ở' : 'VD Mất nước 2 ngày'} {...form.field('description')} />
            <AmountFields form={form} propertyId={summary.propertyId} hint={type === 'Surcharge' ? undefined : 'Nhập số dương — hệ thống tự trừ'} />
            <TextAreaField label="Lý do" required rows={2} maxLength={300} {...form.field('note')} />
            {type !== 'Refund' && <SettledFields form={form} type={type} />}
          </>
        )
      }}
    </FormDialog>
  )
}

/**
 * Sửa một dòng trên phiếu nháp.
 *  - Dòng hệ thống (tiền phòng, điện nước, dịch vụ): sửa tay số lượng / đơn giá / thành tiền; hệ thống giữ số gốc bên cạnh.
 *    Bỏ trống thành tiền ⇒ = số lượng × đơn giá × hệ số kỳ. Dòng Tiền phòng bắt buộc ghi chú; hóa đơn trả phòng: mọi dòng bắt buộc lý do.
 *  - Dòng nhập tay (phụ thu, giảm trừ, hoàn trả): sửa số tiền + lý do (bắt buộc).
 */
export function EditLineDialog({ invoice, line, onSaved, onClose }) {
  const toast = useToast()
  const manual = !line.isSystem
  const finalInvoice = invoice.summary.type === 'Final'
  const noteRequired = manual || finalInvoice || line.type === 'Rent'
  return (
    <FormDialog
      title={`Sửa dòng — ${line.description}`}
      description={manual ? undefined : `Hệ thống tính: ${formatMoney(line.systemAmount ?? line.amount)}. Sửa tay không đổi hợp đồng, bảng giá hay chỉ số gốc.`}
      initial={{ quantity: manual ? null : line.quantity, unitPrice: manual ? null : line.unitPrice, amount: Math.abs(line.amount), note: line.note ?? '' }}
      validate={(v) => ({
        amount: manual ? amountError(v.amount) : v.amount !== null && (v.amount < 0 || v.amount > MAX_LINE_AMOUNT) ? 'Số tiền không hợp lệ.' : null,
        quantity: !manual && v.quantity !== null && v.quantity < 0 ? 'Số lượng từ 0.' : null,
        unitPrice: !manual && v.unitPrice !== null && v.unitPrice < 0 ? 'Đơn giá từ 0.' : null,
        note: noteRequired && !v.note.trim() ? (manual ? 'Nhập lý do.' : finalInvoice ? 'Sửa hóa đơn trả phòng phải ghi lý do.' : 'Sửa tiền phòng phải ghi lý do.') : null,
      })}
      codeFields={{ NOTE_REQUIRED: 'note', NEGATIVE_TOTAL: 'amount', ROOM_CHARGE_CREDIT_TOO_HIGH: 'amount' }}
      onClose={onClose}
      onSubmit={async (v, form) => {
        try {
          const detail = await invoicesApi.editLine(invoice.summary.id, line.id, {
            quantity: manual ? null : v.quantity,
            unitPrice: manual ? null : v.unitPrice,
            amount: v.amount,
            note: blankToNull(v.note),
          })
          onSaved(detail)
          toast.success('Đã sửa dòng.')
          return true
        } catch (error) {
          if (error.code === 'REFUND_EXCEEDS_PAID') {
            const available = error.extensions?.available
            const message = available !== undefined ? `Chỉ còn hoàn được tối đa ${formatMoney(available)}.` : error.detail
            form.setErrors({ amount: message })
            form.setFormError(null)
            toast.error(message)
            return false
          }
          throw error
        }
      }}
    >
      {(form) => (
        <>
          {!manual && (
            <>
              <NumberField label={`Số lượng${line.unit ? ` (${line.unit})` : ''}`} decimals={2} {...form.field('quantity', { type: 'value' })} />
              <NumberField label="Đơn giá" decimals={2} suffix="đ" {...form.field('unitPrice', { type: 'value' })} />
            </>
          )}
          <MoneyField label="Thành tiền" required={manual} hint={manual ? undefined : 'Bỏ trống = số lượng × đơn giá × hệ số kỳ'} {...form.field('amount', { type: 'value' })} />
          <TextAreaField label={manual || finalInvoice ? 'Lý do' : 'Ghi chú'} required={noteRequired} rows={2} maxLength={300} {...form.field('note')} />
        </>
      )}
    </FormDialog>
  )
}

/**
 * Thêm cùng một phụ thu / giảm trừ cho nhiều phiếu nháp (invoices.md#thêm-cho-nhiều-phòng). Hoàn trả không thêm hàng loạt.
 * scope: { invoiceIds } hoặc { propertyId, billingMonth, floor } (+ chọn vài phòng → roomIds) — mỗi phiếu lưu riêng, kết quả từng phòng.
 * `propertyId`: khu của các phiếu đã chọn (nếu biết) để gợi ý khoản thu.
 */
function BulkRooms({ propertyId, floor, form }) {
  const rooms = usePropertyRooms(propertyId)
  const candidates = (rooms.data ?? []).filter((r) => r.currentContract && (!floor || r.floor === floor))
  if (candidates.length === 0) return null
  return (
    <CheckboxGroup
      label="Chỉ các phòng (bỏ trống = mọi phòng trong phạm vi)"
      options={candidates.map((r) => ({ value: r.id, label: r.code }))}
      value={form.values.roomIds}
      onChange={(roomIds) => form.setValue('roomIds', roomIds)}
    />
  )
}

export function BulkLineDialog({ scope, scopeLabel, propertyId, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const [result, setResult] = useState(null)

  if (result) return <BulkResultDialog {...result} onClose={onClose} />

  return (
    <FormDialog
      title="Thêm phụ thu / giảm trừ cho nhiều phòng"
      description={`Áp cho ${scopeLabel}. Chỉ phiếu nháp nhận được dòng mới.`}
      initial={{ type: 'Surcharge', description: '', amount: null, note: '', settled: false, settledOn: '', method: 'Cash', roomIds: [], ...LINE_DEFAULTS }}
      validate={(v) => ({
        description: !v.description.trim() ? 'Nhập nội dung.' : null,
        ...quantityErrors(v),
        amount: v.byQuantity && lineAmount(v) === null ? null : amountError(lineAmount(v)),
        note: !v.note.trim() ? 'Nhập lý do.' : null,
      })}
      codeFields={{ NOTE_REQUIRED: 'note', INVALID_BILLING_MONTH: 'description' }}
      submitLabel="Thêm cho các phòng"
      onClose={onClose}
      onSubmit={async (v) => {
        const body = {
          invoiceIds: scope.invoiceIds ?? null,
          propertyId: scope.propertyId ?? null,
          billingMonth: scope.billingMonth ?? null,
          roomIds: scope.propertyId && v.roomIds.length ? v.roomIds : null,
          floor: scope.floor || null,
          type: v.type,
          description: v.description.trim(),
          ...linePricing(v),
          note: v.note.trim(),
          ...settlement(v),
        }
        const response = await invoicesApi.bulkManualLines(body, { idempotencyKey: idem.keyFor(body) })
        idem.reset()
        await invalidate(queryKeys.invoices.all)
        const failed = response.results.filter((r) => !r.success)
        if (response.added > 0) toast.success(`Đã thêm cho ${response.added} phòng.`)
        if (failed.length === 0) return true
        toast.error(`${failed.length} phòng không thêm được — xem lý do từng phòng.`)
        setResult({
          title: 'Kết quả thêm cho nhiều phòng',
          summary: <Alert tone="warning">Thêm được {response.added} phòng, {failed.length} phòng không được.</Alert>,
          rows: response.results.map((r) => ({ key: r.invoiceId ?? r.roomId, label: `Phòng ${r.roomCode}`, ok: r.success, message: r.message ?? BULK_LINE_ERRORS[r.errorCode] ?? r.errorCode })),
        })
        return false
      }}
    >
      {(form) => (
        <>
          <RadioGroup label="Loại" options={TYPE_OPTIONS.slice(0, 2)} value={form.values.type} onChange={(value) => form.setValue('type', value)} />
          <TextField label="Nội dung" required maxLength={200} placeholder="VD Sơn lại hành lang" {...form.field('description')} />
          {scope.propertyId && <BulkRooms propertyId={scope.propertyId} floor={scope.floor} form={form} />}
          <AmountFields form={form} propertyId={scope.propertyId ?? propertyId} amountLabel="Số tiền mỗi phòng" />
          <TextAreaField label="Lý do" required rows={2} maxLength={300} placeholder="VD Thu chung theo thông báo" {...form.field('note')} />
          <SettledFields form={form} type={form.values.type} />
        </>
      )}
    </FormDialog>
  )
}

const BULK_LINE_ERRORS = {
  NO_DRAFT_INVOICE: 'Phòng chưa có phiếu nháp tháng này',
  INVOICE_NOT_DRAFT: 'Phiếu đã chốt / hủy',
  NEGATIVE_TOTAL: 'Giảm trừ lớn hơn phần thu của phiếu',
  INVOICE_SAVE_FAILED: 'Không lưu được phiếu — tải lại rồi thử lại',
  CONCURRENCY_CONFLICT: 'Phiếu vừa được sửa — tải lại rồi thử lại',
}

/** Xác nhận đã trả lại người thuê phần tổng âm của phiếu "Chờ hoàn" (invoices.md#hoàn-tiền-cho-người-thuê). */
export function ConfirmRefundDialog({ invoice, onSaved, onClose }) {
  const toast = useToast()
  const { summary } = invoice
  return (
    <FormDialog
      title="Xác nhận đã hoàn tiền"
      description={`Đã trả lại người thuê ${formatMoney(summary.refundDue)}.`}
      initial={{ refundedOn: todayVN(), method: 'Cash', note: '' }}
      validate={(v) => ({
        refundedOn: !v.refundedOn ? 'Chọn ngày hoàn.' : v.refundedOn > todayVN() || (invoice.issueDate && v.refundedOn < invoice.issueDate) ? 'Ngày hoàn từ ngày lập phiếu tới hôm nay.' : null,
      })}
      codeFields={{ INVALID_REFUND_DATE: 'refundedOn' }}
      submitLabel="Đã hoàn tiền"
      onClose={onClose}
      onSubmit={async (v) => {
        const detail = await invoicesApi.confirmRefund(summary.id, { refundedOn: v.refundedOn, method: v.method, note: blankToNull(v.note) })
        onSaved(detail)
        toast.success('Đã ghi nhận hoàn tiền cho người thuê.')
      }}
    >
      {(form) => (
        <>
          <DateField label="Ngày hoàn" required {...form.field('refundedOn')} />
          <SelectField label="Hình thức" options={toOptions(PAYMENT_METHOD_LABELS)} {...form.field('method')} />
          <TextField label="Ghi chú" maxLength={300} {...form.field('note')} />
        </>
      )}
    </FormDialog>
  )
}
