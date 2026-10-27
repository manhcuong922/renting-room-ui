import { feesApi, queryKeys } from '@/api'
import { CheckboxField, DateField, FormDialog, SelectField, useToast } from '@/components/ui'
import { usePropertyOptions } from '@/features/shared/queries'
import { useInvalidate } from '@/hooks/useAction'
import { todayVN } from '@/lib/format'

/**
 * Sao chép danh mục khoản thu từ khu khác (fees.md#sao-chép-từ-khu-khác). Trùng tên thì bỏ qua;
 * "Điện" / "Nước" có sẵn của khu này chưa có giá thì được chép giá vào.
 */
export function CopyFeesDialog({ property, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const properties = usePropertyOptions()
  const sources = (properties.data ?? []).filter((p) => p.id !== property.id)

  return (
    <FormDialog
      title="Sao chép khoản thu từ khu khác"
      description={`Chép vào khu ${property.name}. Khoản trùng tên được bỏ qua.`}
      initial={{ sourceId: '', includePrices: true, effectiveFrom: todayVN() }}
      validate={(v) => ({
        sourceId: !v.sourceId ? 'Chọn khu nguồn.' : null,
        effectiveFrom: v.includePrices && !v.effectiveFrom ? 'Chọn ngày hiệu lực của giá.' : null,
      })}
      submitLabel="Sao chép"
      onClose={onClose}
      onSubmit={async (v) => {
        const result = await feesApi.copyFrom(property.id, v.sourceId, {
          includePrices: v.includePrices,
          effectiveFrom: v.includePrices ? v.effectiveFrom : null,
        })
        await invalidate(queryKeys.fees.all)
        toast.success(`Đã chép ${result.copied} khoản thu.`)
        if (result.skipped?.length) toast.info(`Bỏ qua vì trùng tên: ${result.skipped.join(', ')}.`, { duration: 8000 })
      }}
    >
      {(form) => (
        <>
          <SelectField
            label="Khu nguồn"
            required
            placeholder={properties.isPending ? 'Đang tải…' : sources.length ? 'Chọn khu…' : 'Chưa có khu nào khác'}
            options={sources.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
            {...form.field('sourceId')}
          />
          <CheckboxField label="Chép cả giá đang áp dụng" {...form.field('includePrices', { type: 'checkbox' })} />
          {form.values.includePrices && <DateField label="Giá hiệu lực từ ngày" required {...form.field('effectiveFrom')} />}
        </>
      )}
    </FormDialog>
  )
}
