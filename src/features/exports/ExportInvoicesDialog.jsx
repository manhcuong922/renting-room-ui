import { exportsApi } from '@/api'
import { Alert, Button, CheckboxField, CheckboxGroup, FormGrid, FormSection, Modal, Spinner, TextField, useToast } from '@/components/ui'
import { usePropertyOptions } from '@/features/shared/queries'
import { useForm } from '@/hooks/useForm'
import { saveBlob } from '@/lib/download'
import { currentBillingMonth } from '@/lib/format'

const MAX_MONTHS = 24
const monthsBetween = (from, to) => {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

function validate(v) {
  return {
    fromMonth: !v.fromMonth ? 'Chọn từ tháng.' : null,
    toMonth: !v.toMonth
      ? 'Chọn đến tháng.'
      : v.fromMonth && v.toMonth < v.fromMonth
        ? 'Đến tháng phải sau từ tháng.'
        : v.fromMonth && monthsBetween(v.fromMonth, v.toMonth) >= MAX_MONTHS
          ? `Tối đa ${MAX_MONTHS} tháng.`
          : null,
  }
}

/**
 * Xuất Excel thu tiền theo kỳ (exports.md#thu-tiền-theo-kỳ): mỗi hóa đơn 1 dòng — đã thu, bỏ nợ, sửa giảm (lý do + người), còn nợ, đơn giá;
 * sheet tổng theo kỳ. Quản lý khu: server chỉ trả khu được giao.
 */
export function ExportInvoicesDialog({ onClose, presetPropertyIds = [], presetMonth }) {
  const toast = useToast()
  const properties = usePropertyOptions()
  const month = presetMonth || currentBillingMonth()
  const form = useForm(
    { propertyIds: presetPropertyIds, fromMonth: month, toMonth: month, includeDrafts: false },
    { validate, codeFields: { INVALID_MONTH_RANGE: 'toMonth', INVALID_BILLING_MONTH: 'fromMonth' } },
  )

  const submit = form.handleSubmit(async (v) => {
    const { blob, filename } = await exportsApi.monthlyInvoices(v)
    saveBlob(blob, filename ?? `thu-tien-theo-ky_${v.fromMonth}_${v.toMonth}.xlsx`)
    toast.success('Đã xuất file Excel.')
    onClose()
  })

  return (
    <Modal
      open
      onClose={onClose}
      title="Xuất Excel thu tiền theo kỳ"
      description="Mỗi hóa đơn một dòng: đã thu, bỏ nợ, sửa giảm (kèm lý do, người làm), còn nợ — và một sheet tổng theo kỳ."
      size="md"
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form="export-invoices-form" loading={form.submitting}>
            Xuất Excel
          </Button>
        </>
      }
    >
      <form id="export-invoices-form" onSubmit={submit} noValidate>
        {form.formError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert>{form.formError}</Alert>
          </div>
        )}
        <FormSection title="Khu trọ" description="Để trống = tất cả khu bạn quản lý.">
          {properties.isPending ? (
            <Spinner />
          ) : (
            <CheckboxGroup
              label="Khu trọ"
              options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
              value={form.values.propertyIds}
              onChange={(ids) => form.setValue('propertyIds', ids)}
            />
          )}
        </FormSection>
        <FormSection title="Kỳ thu">
          <FormGrid>
            <TextField label="Từ tháng" type="month" required {...form.field('fromMonth')} />
            <TextField label="Đến tháng" type="month" required hint={`Tối đa ${MAX_MONTHS} tháng`} {...form.field('toMonth')} />
            <CheckboxField
              className="span-full"
              label="Kèm phiếu nháp"
              description="Mặc định chỉ hóa đơn đã chốt."
              {...form.field('includeDrafts', { type: 'checkbox' })}
            />
          </FormGrid>
        </FormSection>
      </form>
    </Modal>
  )
}
