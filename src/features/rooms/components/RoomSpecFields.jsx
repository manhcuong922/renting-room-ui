import { CheckboxGroup, FormGrid, MoneyField, NumberField, TextAreaField, TextField } from '@/components/ui'
import { AMENITY_LABELS } from '@/constants/enums'
import { getIn } from '@/hooks/useForm'

/** Nhóm ô thông số phòng — dùng chung cho tạo 1 phòng, sửa phòng và tạo hàng loạt. `prefix` = 'spec.' hoặc ''. */
export function RoomSpecFields({ form, prefix = 'spec.', showFloor = true, showDescription = true }) {
  const currentAmenities = getIn(form.values, `${prefix}amenities`) ?? []
  // Giữ lại mã tiện ích lạ (do client khác tạo) để không bị mất khi lưu.
  const options = [...new Set([...Object.keys(AMENITY_LABELS), ...currentAmenities])].map((code) => ({
    value: code,
    label: AMENITY_LABELS[code] ?? code,
  }))

  return (
    <FormGrid>
      {showFloor && <TextField label="Tầng" maxLength={10} hint="Dùng để nhóm sơ đồ phòng, VD 1, 2, Trệt" {...form.field(`${prefix}floor`)} />}
      <NumberField label="Số người tối đa" required {...form.field(`${prefix}maxOccupants`, { type: 'value' })} />
      <NumberField label="Diện tích" decimals={2} suffix="m²" {...form.field(`${prefix}areaM2`, { type: 'value' })} />
      <MoneyField label="Giá niêm yết / tháng" hint="Gợi ý khi tạo hợp đồng" {...form.field(`${prefix}listedRent`, { type: 'value' })} />
      <MoneyField label="Tiền cọc gợi ý" {...form.field(`${prefix}defaultDeposit`, { type: 'value' })} />
      <CheckboxGroup
        label="Tiện ích"
        className="span-full"
        options={options}
        value={currentAmenities}
        onChange={(v) => form.setValue(`${prefix}amenities`, v)}
      />
      {showDescription && <TextAreaField label="Mô tả" rows={2} maxLength={2000} className="span-full" {...form.field(`${prefix}description`)} />}
    </FormGrid>
  )
}
