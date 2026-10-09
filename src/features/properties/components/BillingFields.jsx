import { FormGrid, NumberField, SelectField } from '@/components/ui'
import { CHARGE_MODE_LABELS, PRORATION_MODE_LABELS, toOptions } from '@/constants/enums'
import { ANCHOR_DAY_MAX } from '../propertyForm'

/**
 * Ô cài đặt kỳ thu của khu (docs/api/properties.md#cài-đặt-kỳ-thu-billing).
 * `prefix` = 'billing.' trong form tạo khu, '' trong tab Kỳ thu.
 */
export function BillingFields({ form, prefix = '', disabled }) {
  const field = (name, opts) => ({ ...form.field(`${prefix}${name}`, opts), disabled })
  return (
    <FormGrid cols={3}>
      <NumberField
        label="Ngày chốt kỳ thu"
        required
        hint={`1–${ANCHOR_DAY_MAX} — tháng nào cũng có ngày chốt`}
        {...field('anchorDay', { type: 'value' })}
      />
      <SelectField label="Thu tiền phòng" options={toOptions(CHARGE_MODE_LABELS)} {...field('chargeMode')} />
      <NumberField label="Hạn đóng sau ngày chốt" suffix="ngày" {...field('paymentDueDays', { type: 'value' })} />
      <SelectField label="Kỳ lẻ (vào / trả giữa kỳ)" options={toOptions(PRORATION_MODE_LABELS)} {...field('prorationMode')} />
      <NumberField
        label="Báo trước khi trả phòng"
        suffix="ngày"
        hint="Gợi ý khi tạo hợp đồng — hợp đồng giữ số ngày riêng"
        {...field('noticeDays', { type: 'value' })}
      />
    </FormGrid>
  )
}
