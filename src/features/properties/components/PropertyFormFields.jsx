import { Alert, FormGrid, FormSection, NumberField, SelectField, TextAreaField, TextField } from '@/components/ui'
import { CHARGE_MODE_LABELS, PRORATION_MODE_LABELS, toOptions } from '@/constants/enums'

/** Form thông tin khu + cài đặt thu (dùng cho tạo mới và tab Thông tin). `form` = useForm(). */
export function PropertyFormFields({ form, creating }) {
  return (
    <>
      {form.formError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert>{form.formError}</Alert>
        </div>
      )}
      <FormSection title="Thông tin khu">
        <FormGrid>
          {creating && (
            <TextField label="Mã khu" required maxLength={32} hint="Tự viết hoa, không sửa được sau khi tạo. VD KCG" {...form.field('code')} />
          )}
          <TextField label="Tên khu" required maxLength={200} className={creating ? undefined : 'span-full'} {...form.field('name')} />
          <TextField label="Số nhà, ngõ, đường" required maxLength={300} className="span-full" {...form.field('address.streetAddress')} />
          <TextField label="Xã / phường" required {...form.field('address.communeName')} />
          <TextField label="Tỉnh / thành phố" required {...form.field('address.provinceName')} />
          <TextField label="Mã khách hàng điện lực (EVN)" maxLength={20} {...form.field('evnCustomerCode')} />
          <TextAreaField label="Mô tả" rows={2} className="span-full" {...form.field('description')} />
        </FormGrid>
      </FormSection>
      <FormSection title="Thông tin đất" description="In vào hợp đồng (không bắt buộc).">
        <FormGrid cols={3}>
          <TextField label="Số thửa" {...form.field('land.parcelNo')} />
          <TextField label="Số tờ bản đồ" {...form.field('land.mapSheetNo')} />
          <TextField label="Số giấy chứng nhận" {...form.field('land.ownershipCertificateNo')} />
        </FormGrid>
      </FormSection>
      <FormSection
        title="Cài đặt thu mặc định"
        description="Là giá trị gợi ý khi tạo hợp đồng mới. Đổi cài đặt chỉ áp dụng cho hợp đồng tạo sau — hợp đồng cũ giữ cài đặt riêng."
      >
        <FormGrid cols={3}>
          <NumberField label="Ngày chốt kỳ thu" required hint="31 = cuối tháng với tháng ngắn" {...form.field('billingDefaults.anchorDay', { type: 'value' })} />
          <SelectField label="Thu tiền phòng" options={toOptions(CHARGE_MODE_LABELS)} {...form.field('billingDefaults.chargeMode')} />
          <NumberField label="Hạn đóng sau ngày chốt" suffix="ngày" {...form.field('billingDefaults.paymentDueDays', { type: 'value' })} />
          <SelectField label="Tháng lẻ" options={toOptions(PRORATION_MODE_LABELS)} {...form.field('billingDefaults.prorationMode')} />
          <NumberField label="Báo trước khi trả phòng" suffix="ngày" {...form.field('billingDefaults.noticeDays', { type: 'value' })} />
        </FormGrid>
      </FormSection>
    </>
  )
}
