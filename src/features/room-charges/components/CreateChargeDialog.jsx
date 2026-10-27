import { roomChargesApi } from '@/api'
import { CheckboxField, DateField, FormDialog, MoneyField, RadioGroup, SelectField, TextAreaField, TextField, useToast } from '@/components/ui'
import { PAYMENT_METHOD_LABELS, ROOM_CHARGE_KIND_LABELS, toOptions } from '@/constants/enums'
import { CHARGE_AFFECTED } from '@/features/shared/affected'
import { useInvalidate } from '@/hooks/useAction'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { formatMoney, todayVN } from '@/lib/format'

const MAX_AMOUNT = 100_000_000

/**
 * Tạo khoản phát sinh cho phòng đang có người thuê, ngay lúc xảy ra (room-charges.md#tạo-khoản).
 * Khoản bù chưa trả (cộng các khoản bù chưa trả khác) không vượt một tháng tiền phòng — bù nhiều hơn thì trả trực tiếp rồi chọn "đã trả ngay".
 */
export function CreateChargeDialog({ room, kind = 'Surcharge', onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  return (
    <FormDialog
      title={`Thêm khoản phát sinh — phòng ${room.code}`}
      description="Khoản tự vào phiếu tiền phòng của kỳ chứa ngày phát sinh."
      initial={{ kind, description: '', amount: null, incurredOn: todayVN(), reason: '', settled: false, settledOn: '', method: 'Cash' }}
      validate={(v) => ({
        description: !v.description.trim() ? 'Nhập nội dung.' : null,
        amount: v.amount === null || v.amount <= 0 ? 'Nhập số tiền lớn hơn 0.' : v.amount > MAX_AMOUNT ? `Tối đa ${formatMoney(MAX_AMOUNT)}.` : null,
        incurredOn: !v.incurredOn ? 'Chọn ngày.' : v.incurredOn > todayVN() ? 'Ngày phát sinh không ở tương lai.' : null,
        reason: !v.reason.trim() ? 'Nhập lý do.' : null,
        settledOn: v.settled && v.settledOn && v.settledOn > todayVN() ? 'Ngày không ở tương lai.' : null,
      })}
      codeFields={{
        ROOM_CHARGE_NO_TENANT: 'incurredOn',
        INVALID_INCURRED_DATE: 'incurredOn',
        INVALID_SETTLED_DATE: 'settledOn',
        ROOM_CHARGE_NO_OPEN_INVOICE: 'incurredOn',
      }}
      submitLabel="Thêm khoản"
      onClose={onClose}
      onSubmit={async (v, form) => {
        const body = {
          kind: v.kind,
          description: v.description.trim(),
          amount: v.amount,
          incurredOn: v.incurredOn,
          reason: v.reason.trim(),
          settled: v.settled,
          settledOn: v.settled ? v.settledOn || null : null,
          method: v.settled ? v.method : null,
        }
        try {
          await roomChargesApi.create(room.id, body, { idempotencyKey: idem.keyFor(body) })
        } catch (error) {
          // Khoản bù vượt một tháng tiền phòng: body có `limit`.
          if (error.code === 'ROOM_CHARGE_CREDIT_TOO_HIGH') {
            const limit = error.extensions?.limit
            const message = limit !== undefined ? `Tổng các khoản bù chưa trả không vượt ${formatMoney(limit)} (một tháng tiền phòng). Bù nhiều hơn thì trả trực tiếp rồi chọn “đã trả ngay”.` : error.detail
            form.setErrors({ amount: message })
            form.setFormError(null)
            toast.error(message)
            return false
          }
          throw error
        }
        idem.reset()
        await invalidate(...CHARGE_AFFECTED)
        toast.success('Đã thêm khoản phát sinh.')
        return true
      }}
    >
      {(form) => {
        const surcharge = form.values.kind === 'Surcharge'
        return (
          <>
            <RadioGroup label="Loại" options={toOptions(ROOM_CHARGE_KIND_LABELS)} value={form.values.kind} onChange={(value) => form.setValue('kind', value)} />
            <TextField label="Nội dung" required maxLength={200} placeholder={surcharge ? 'VD Thay khóa cửa' : 'VD Mất nước 2 ngày'} {...form.field('description')} />
            <MoneyField label="Số tiền" required {...form.field('amount', { type: 'value' })} />
            <DateField label="Ngày phát sinh" required {...form.field('incurredOn')} />
            <TextAreaField label="Lý do" required rows={2} maxLength={300} placeholder={surcharge ? 'VD Người thuê làm hỏng khóa' : 'VD Sự cố bồn nước'} {...form.field('reason')} />
            <CheckboxField
              label={surcharge ? 'Người thuê đã trả ngay' : 'Đã trả cho người thuê ngay'}
              description="Vẫn hiện trên phiếu cho đầy đủ nhưng không tính vào tổng."
              {...form.field('settled', { type: 'checkbox' })}
            />
            {form.values.settled && (
              <>
                <DateField label="Ngày thanh toán" hint="Bỏ trống = ngày phát sinh" {...form.field('settledOn')} />
                <SelectField label="Hình thức" options={toOptions(PAYMENT_METHOD_LABELS)} {...form.field('method')} />
              </>
            )}
          </>
        )
      }}
    </FormDialog>
  )
}
