import { Alert, FormGrid, FormSection, TextAreaField, TextField } from '@/components/ui'
import { BillingFields } from './BillingFields'

/**
 * Form thông tin khu (tạo mới và tab Thông tin). `form` = useForm().
 * Cài đặt kỳ thu chỉ nhập khi tạo khu — sau đó đổi ở tab Kỳ thu (có xem trước kỳ chuyển tiếp).
 */
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
      {creating && (
        <FormSection
          title="Cài đặt kỳ thu"
          description="Mọi phòng / hợp đồng của khu dùng chung (hợp đồng không chọn riêng). Đổi sau ở tab Kỳ thu của khu."
        >
          <BillingFields form={form} prefix="billing." />
        </FormSection>
      )}
    </>
  )
}
