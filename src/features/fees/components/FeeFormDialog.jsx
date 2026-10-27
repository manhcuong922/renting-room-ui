import { feesApi, queryKeys } from '@/api'
import { Alert, Button, CheckboxField, FormGrid, FormSection, Modal, NumberField, RadioGroup, SelectField, TextField, useToast } from '@/components/ui'
import { CHARGE_BASIS_LABELS, FEE_GROUP_LABELS, VEHICLE_TYPE_LABELS, toOptions } from '@/constants/enums'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { DEFAULT_UNIT, toCreateFeeBody, toFeeForm, toUpdateFeeBody, validateFee } from '../feeForm'
import { PriceFields } from './PriceFields'

const FORM_ID = 'fee-form'

/**
 * Thêm (fee = null) hoặc sửa khoản thu của khu (fees.md#tạo-khoản-thu, #chi-tiết--sửa-khoản-thu).
 * Nhóm và cách tính không đổi được sau khi tạo — cần đổi thì tạo khoản mới rồi ngừng dùng khoản cũ.
 */
export function FeeFormDialog({ propertyId, fee, onClose }) {
  const creating = !fee
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const form = useForm(toFeeForm(fee), {
    validate: (v) => validateFee(v, { creating }),
    codeFields: { FEE_NAME_TAKEN: 'name', INVALID_CHARGE_BASIS: 'chargeBasis', FEE_TIERS_METERED_ONLY: 'initialPrice.tiers' },
  })
  const v = form.values
  const service = v.group === 'Service'
  const perUnit = service && v.chargeBasis === 'PerUnit'

  // Đổi nhóm / cách tính khi tạo → gợi ý lại đơn vị nếu người dùng chưa tự sửa.
  const suggestUnit = (group, chargeBasis) => {
    const current = DEFAULT_UNIT[v.group === 'Metered' ? 'Metered' : v.chargeBasis]
    if (v.unit.trim() === '' || v.unit === current) form.setValue('unit', DEFAULT_UNIT[group === 'Metered' ? 'Metered' : chargeBasis])
  }

  const submit = form.handleSubmit(async (values) => {
    if (creating) {
      const body = toCreateFeeBody(values)
      const result = await feesApi.create(propertyId, body, { idempotencyKey: idem.keyFor(body) })
      idem.reset()
      toast.success('Đã thêm khoản thu.')
      result.warnings?.forEach((w) => toast.warning(w.message))
    } else {
      await feesApi.update(fee.id, toUpdateFeeBody(values, fee.version))
      toast.success('Đã lưu khoản thu.')
    }
    await invalidate(queryKeys.fees.all)
    onClose()
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={creating ? 'Thêm khoản thu' : `Sửa khoản thu — ${fee.name}`}
      description={creating ? 'Nhóm và cách tính không đổi được sau khi tạo.' : undefined}
      size="md"
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} loading={form.submitting}>
            {creating ? 'Thêm khoản thu' : 'Lưu'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        {form.formError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert>{form.formError}</Alert>
          </div>
        )}
        <FormSection>
          <FormGrid>
            {creating ? (
              <RadioGroup
                label="Nhóm"
                required
                className="span-full"
                options={toOptions(FEE_GROUP_LABELS)}
                value={v.group}
                onChange={(group) => {
                  suggestUnit(group, v.chargeBasis)
                  form.setValue('group', group)
                }}
              />
            ) : (
              <TextField label="Nhóm" value={`${FEE_GROUP_LABELS[fee.group]}${fee.chargeBasis ? ` — ${CHARGE_BASIS_LABELS[fee.chargeBasis]}` : ''}`} disabled readOnly className="span-full" />
            )}
            {creating && service && (
              <SelectField
                label="Cách tính"
                required
                options={toOptions(CHARGE_BASIS_LABELS)}
                hint={v.chargeBasis === 'PerOccupant' ? 'Đơn giá × số người ở đầu kỳ' : v.chargeBasis === 'PerUnit' ? 'Đơn giá × số gói đăng ký trên hợp đồng' : 'Đơn giá × 1 mỗi kỳ'}
                {...form.field('chargeBasis')}
                onChange={(e) => {
                  suggestUnit(v.group, e.target.value)
                  form.setValue('chargeBasis', e.target.value)
                }}
              />
            )}
            <TextField label="Tên khoản thu" required maxLength={100} placeholder="VD Mạng, Giữ xe máy" {...form.field('name')} />
            <TextField label="Đơn vị" required maxLength={20} placeholder="kWh, m³, người, phòng, xe…" {...form.field('unit')} />
            {perUnit && (
              <>
                <NumberField label="Số gói mặc định" decimals={2} hint="Điền sẵn khi gắn vào hợp đồng" {...form.field('defaultQuantity', { type: 'value' })} />
                <SelectField
                  label="Là phí giữ xe loại"
                  placeholder="Không phải phí giữ xe"
                  options={toOptions(VEHICLE_TYPE_LABELS)}
                  hint="Số xe đăng ký khác số gói → hợp đồng có cảnh báo"
                  {...form.field('vehicleType')}
                />
              </>
            )}
            <NumberField label="Thứ tự hiển thị" hint="Số nhỏ đứng trước (0–1000)" {...form.field('sortOrder', { type: 'value' })} />
            {service && (
              <CheckboxField
                label="Tự gắn vào hợp đồng mới"
                description="Hợp đồng mới của khu tự có khoản này (vẫn bỏ được khi tạo hợp đồng)."
                {...form.field('autoAttach', { type: 'checkbox' })}
              />
            )}
          </FormGrid>
        </FormSection>

        {creating && (
          <FormSection title="Giá ban đầu" description={service ? undefined : 'Điện, nước tính theo công tơ của phòng — không gắn vào hợp đồng.'}>
            <FormGrid>
              <CheckboxField
                className="span-full"
                label="Nhập giá ngay"
                description="Bỏ chọn nếu nhập giá sau — khoản chưa có giá thì chưa lập được phiếu."
                {...form.field('withPrice', { type: 'checkbox' })}
              />
              {v.withPrice && <PriceFields form={form} path="initialPrice." group={v.group} unit={v.unit.trim()} />}
            </FormGrid>
          </FormSection>
        )}
      </form>
    </Modal>
  )
}
