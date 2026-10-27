import { metersApi, queryKeys } from '@/api'
import { Alert, DateField, FormDialog, NumberField, RadioGroup, SelectField, TextAreaField, TextField, useToast } from '@/components/ui'
import { ADJUSTMENT_HANDLING_LABELS, PAYMENT_METHOD_LABELS, toOptions } from '@/constants/enums'
import { useInvalidate } from '@/hooks/useAction'
import { blankToNull } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { formatMoney, todayVN } from '@/lib/format'
import { dateError, formatReading, monotonicMessage, readingError } from '../meterRules'

// Đổi công tơ / chỉ số ⇒ phiếu nháp của phòng "Cần tính lại"; khoản thu có thể hết / còn công tơ hoạt động.
const AFFECTED = [queryKeys.rooms.all, queryKeys.meters.all, queryKeys.invoices.all]

/** Ném lại lỗi sau khi gắn câu gợi ý khoảng hợp lệ vào ô chỉ số (READING_NOT_MONOTONIC). */
function attachMonotonic(error, form, field) {
  if (error.code !== 'READING_NOT_MONOTONIC') return false
  form.setErrors({ [field]: monotonicMessage(error) })
  form.setFormError(null)
  return true
}

/** Lắp công tơ cho phòng (meters.md#lắp). `fees`: khoản điện nước theo công tơ của khu mà phòng chưa có công tơ hoạt động. */
export function InstallMeterDialog({ room, fees, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  return (
    <FormDialog
      title={`Lắp công tơ — phòng ${room.code}`}
      initial={{ feeTypeId: fees.length === 1 ? fees[0].id : '', serialNo: '', installedDate: todayVN(), initialValue: 0, note: '' }}
      validate={(v) => ({
        feeTypeId: !v.feeTypeId ? 'Chọn khoản thu.' : null,
        installedDate: dateError(v.installedDate),
        initialValue: readingError(v.initialValue),
      })}
      codeFields={{ METER_ALREADY_ACTIVE: 'feeTypeId', FEE_NOT_METERED: 'feeTypeId', FEE_ARCHIVED: 'feeTypeId', FEE_NOT_IN_PROPERTY: 'feeTypeId', INVALID_READING_DATE: 'installedDate' }}
      submitLabel="Lắp công tơ"
      onClose={onClose}
      onSubmit={async (v) => {
        const body = { feeTypeId: v.feeTypeId, serialNo: blankToNull(v.serialNo), installedDate: v.installedDate, initialValue: v.initialValue, note: blankToNull(v.note) }
        await metersApi.install(room.id, body, { idempotencyKey: idem.keyFor(body) })
        idem.reset()
        await invalidate(...AFFECTED)
        toast.success('Đã lắp công tơ.')
      }}
    >
      {(form) => (
        <>
          <SelectField label="Khoản thu" required placeholder="Chọn…" options={fees.map((f) => ({ value: f.id, label: `${f.name} (${f.unit})` }))} {...form.field('feeTypeId')} />
          <TextField label="Số serial" maxLength={50} {...form.field('serialNo')} />
          <DateField label="Ngày lắp" required {...form.field('installedDate')} />
          <NumberField label="Chỉ số ban đầu" required decimals={2} {...form.field('initialValue', { type: 'value' })} />
          <TextField label="Ghi chú" maxLength={300} {...form.field('note')} />
        </>
      )}
    </FormDialog>
  )
}

/** Thay công tơ: công tơ cũ ngừng với số cuối bắt buộc, công tơ mới bắt đầu cùng ngày (meters.md#thay-công-tơ-phiên-bản). */
export function ReplaceMeterDialog({ meter, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const latest = meter.latestReading
  return (
    <FormDialog
      title={`Thay công tơ ${meter.feeTypeName}`}
      description="Cuối kỳ chỉ cần nhập số của công tơ mới — phiếu tự cộng phần của công tơ cũ."
      initial={{ date: todayVN(), oldFinalValue: null, newSerialNo: '', newInitialValue: 0, note: '' }}
      validate={(v) => ({ date: dateError(v.date), oldFinalValue: readingError(v.oldFinalValue), newInitialValue: readingError(v.newInitialValue) })}
      codeFields={{ INVALID_READING_DATE: 'date' }}
      submitLabel="Thay công tơ"
      onClose={onClose}
      onSubmit={async (v, form) => {
        const body = { date: v.date, oldFinalValue: v.oldFinalValue, newSerialNo: blankToNull(v.newSerialNo), newInitialValue: v.newInitialValue, note: blankToNull(v.note) }
        try {
          await metersApi.replace(meter.id, body, { idempotencyKey: idem.keyFor(body) })
        } catch (error) {
          if (attachMonotonic(error, form, 'oldFinalValue')) {
            toast.error(monotonicMessage(error))
            return false
          }
          throw error
        }
        idem.reset()
        await invalidate(...AFFECTED)
        toast.success('Đã thay công tơ.')
        return true
      }}
    >
      {(form) => (
        <>
          <DateField label="Ngày thay" required {...form.field('date')} />
          <NumberField
            label={`Số cuối công tơ cũ${meter.serialNo ? ` (${meter.serialNo})` : ''}`}
            required
            decimals={2}
            suffix={meter.unit}
            hint={latest ? `Chỉ số gần nhất: ${formatReading(latest.value)}` : undefined}
            {...form.field('oldFinalValue', { type: 'value' })}
          />
          <TextField label="Số serial công tơ mới" maxLength={50} {...form.field('newSerialNo')} />
          <NumberField label="Chỉ số ban đầu công tơ mới" required decimals={2} suffix={meter.unit} {...form.field('newInitialValue', { type: 'value' })} />
          <TextField label="Ghi chú" maxLength={300} placeholder="VD Công tơ cũ hỏng" {...form.field('note')} />
        </>
      )}
    </FormDialog>
  )
}

/** Tháo công tơ (không thay) — bắt buộc số cuối. Phòng đang thuê ⇒ cảnh báo, vẫn tháo (meters.md#tháo-không-thay). */
export function RemoveMeterDialog({ meter, occupied, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const latest = meter.latestReading
  return (
    <FormDialog
      title={`Tháo công tơ ${meter.feeTypeName}?`}
      initial={{ date: todayVN(), finalValue: null, note: '' }}
      validate={(v) => ({ date: dateError(v.date), finalValue: readingError(v.finalValue) })}
      codeFields={{ INVALID_READING_DATE: 'date' }}
      submitLabel="Tháo công tơ"
      tone="danger"
      onClose={onClose}
      onSubmit={async (v, form) => {
        let result
        try {
          result = await metersApi.remove(meter.id, { date: v.date, finalValue: v.finalValue, note: blankToNull(v.note) })
        } catch (error) {
          if (attachMonotonic(error, form, 'finalValue')) {
            toast.error(monotonicMessage(error))
            return false
          }
          throw error
        }
        await invalidate(...AFFECTED, queryKeys.fees.all)
        toast.success('Đã tháo công tơ.')
        // Cảnh báo không chặn: công tơ đã tháo (VD phòng đang có người thuê).
        result?.warnings?.forEach((w) => toast.warning(w.message, { duration: 10_000 }))
        return true
      }}
    >
      {(form) => (
        <>
          {occupied && (
            <Alert tone="warning">Phòng đang có người thuê — từ kỳ sau phiếu tiền phòng không còn dòng {meter.feeTypeName}. Nếu chỉ đổi công tơ, hãy dùng “Thay công tơ”.</Alert>
          )}
          <DateField label="Ngày tháo" required {...form.field('date')} />
          <NumberField
            label="Số cuối"
            required
            decimals={2}
            suffix={meter.unit}
            hint={latest ? `Chỉ số gần nhất: ${formatReading(latest.value)}` : undefined}
            {...form.field('finalValue', { type: 'value' })}
          />
          <TextField label="Ghi chú" maxLength={300} {...form.field('note')} />
        </>
      )}
    </FormDialog>
  )
}

/** Sửa chỉ số nhập sai: phải ≥ chỉ số trước và ≤ chỉ số sau; đã dùng cho phiếu đã chốt thì khóa (meters.md#lịch-sử--sửa-chỉ-số). */
export function CorrectReadingDialog({ meter, reading, onClose, onLocked }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  return (
    <FormDialog
      title="Sửa chỉ số"
      initial={{ value: reading.value, note: reading.note ?? '' }}
      validate={(v) => ({ value: readingError(v.value) })}
      codeFields={{ READING_LOCKED: 'value' }}
      onClose={onClose}
      onSubmit={async (v, form) => {
        try {
          await metersApi.correctReading(reading.id, { value: v.value, note: blankToNull(v.note) })
        } catch (error) {
          // Đã dùng cho hóa đơn đã chốt ⇒ chuyển sang "Điều chỉnh chỉ số đã chốt" (giữ số vừa nhập).
          if (error.code === 'READING_LOCKED' && onLocked) {
            onLocked(v.value)
            return false
          }
          if (attachMonotonic(error, form, 'value')) {
            toast.error(monotonicMessage(error))
            return false
          }
          throw error
        }
        await invalidate(...AFFECTED)
        toast.success('Đã sửa chỉ số.')
        return true
      }}
    >
      {(form) => (
        <>
          <NumberField label="Chỉ số" required decimals={2} suffix={meter.unit} {...form.field('value', { type: 'value' })} />
          <TextField label="Ghi chú" maxLength={300} placeholder="VD Đọc lại" {...form.field('note')} />
        </>
      )}
    </FormDialog>
  )
}

const ADJUST_HANDLING_OPTIONS = [
  { value: '', label: 'Tự chọn theo hóa đơn' },
  { value: 'Immediate', label: ADJUSTMENT_HANDLING_LABELS.Immediate },
  { value: 'NextInvoice', label: ADJUSTMENT_HANDLING_LABELS.NextInvoice },
]

/**
 * Điều chỉnh chỉ số đã chốt (meters.md#điều-chỉnh-chỉ-số-đã-chốt): hóa đơn chưa thu ⇒ tính lại ngay trên hóa đơn; đã có tiền ⇒ chọn
 * "Xử lý ngay" (hoàn / thu thêm) hoặc "Đẩy sang hóa đơn sau" (khoản điều chỉnh). Làm hóa đơn tháng âm ⇒ gợi ý "Đẩy sang hóa đơn sau".
 */
export function AdjustReadingDialog({ meter, reading, initialValue, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const isFinal = reading.kind === 'Final'
  return (
    <FormDialog
      title="Điều chỉnh chỉ số đã chốt"
      description={`Chỉ số ${formatReading(reading.value)} đã dùng cho hóa đơn đã chốt. Hóa đơn chưa thu tiền thì tính lại ngay; đã có tiền thì chọn cách xử lý phần chênh.`}
      initial={{ value: initialValue ?? reading.value, reason: '', handling: '', settleDate: todayVN(), method: 'Cash', afterEnd: '' }}
      validate={(v) => ({
        value: readingError(v.value) ?? (v.value === reading.value ? 'Trùng số hiện tại.' : null),
        reason: !v.reason.trim() ? 'Nhập lý do.' : null,
      })}
      codeFields={{ READING_UNCHANGED: 'value', ADJUSTMENT_HANDLING_REQUIRED: 'handling', INVALID_HANDLING: 'handling' }}
      submitLabel="Điều chỉnh"
      onClose={onClose}
      onSubmit={async (v, form) => {
        const body = {
          value: v.value,
          reason: v.reason.trim(),
          handling: isFinal ? null : v.handling || null,
          // Số cuối lúc trả phòng (HĐ đã kết thúc): Đã trả lại = settlement · Không trả lại = notReturned · bỏ trống = chờ xử lý.
          settlement: (isFinal ? v.afterEnd === 'settle' : v.handling === 'Immediate') ? { date: v.settleDate, method: v.method } : null,
          ...(isFinal && v.afterEnd === 'notReturned' && { notReturned: true }),
        }
        let result
        try {
          result = await metersApi.adjustReading(reading.id, body, { idempotencyKey: idem.keyFor(body) })
        } catch (error) {
          if (attachMonotonic(error, form, 'value')) {
            toast.error(monotonicMessage(error))
            return false
          }
          if (error.code === 'ADJUSTMENT_NEGATIVE_TOTAL') {
            form.setValue('handling', 'NextInvoice')
            toast.error(`${error.detail ?? 'Tính lại làm hóa đơn tháng âm.'} Đã chọn “Đẩy sang hóa đơn sau” — bấm Điều chỉnh lại.`)
            form.setFormError(null)
            return false
          }
          throw error
        }
        idem.reset()
        await invalidate(...AFFECTED, queryKeys.payments.all, queryKeys.roomCharges.all)
        toast.success(`Đã điều chỉnh chỉ số — ${ADJUSTMENT_HANDLING_LABELS[result.handling] ?? result.handling}${result.charge ? `, khoản điều chỉnh ${formatMoney(result.charge.amount)}` : ''}.`)
        result.warnings?.forEach((w) => toast.warning(w.message, { duration: 10_000 }))
        return true
      }}
    >
      {(form) => (
        <>
          <NumberField label="Chỉ số đúng" required decimals={2} suffix={meter.unit} {...form.field('value', { type: 'value' })} />
          <TextAreaField label="Lý do" required rows={2} maxLength={300} placeholder="VD Gõ nhầm 1.338 thành 1.388" {...form.field('reason')} />
          {isFinal ? (
            <RadioGroup
              label="Phần chênh (chỉ giảm được số cuối)"
              options={[
                { value: '', label: 'Chờ xử lý' },
                { value: 'settle', label: 'Đã trả lại' },
                { value: 'notReturned', label: 'Không trả lại' },
              ]}
              value={form.values.afterEnd}
              onChange={(a) => form.setValue('afterEnd', a)}
            />
          ) : (
            <RadioGroup label="Nếu hóa đơn đã có tiền" options={ADJUST_HANDLING_OPTIONS} value={form.values.handling} onChange={(h) => form.setValue('handling', h)} error={form.errors.handling} />
          )}
          {(isFinal ? form.values.afterEnd === 'settle' : form.values.handling === 'Immediate') && (
            <>
              <DateField label="Ngày trả lại / thu thêm" {...form.field('settleDate')} />
              <SelectField label="Hình thức" options={toOptions(PAYMENT_METHOD_LABELS)} {...form.field('method')} />
            </>
          )}
        </>
      )}
    </FormDialog>
  )
}
