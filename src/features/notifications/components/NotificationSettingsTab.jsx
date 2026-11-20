import { notificationsApi, queryKeys } from '@/api'
import { Alert, Button, CheckboxField, FormSection, NumberField, useToast } from '@/components/ui'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { useNotificationChannels } from '../hooks'
import { AnnouncementsSection } from './AnnouncementsSection'

const MAX_STEPS = 3
const MIN_DAY = 1
const MAX_DAY = 60

/** Mốc nhắc nợ: tối đa 3, mỗi mốc 1–60 ngày sau hạn, không trùng, tăng dần (NT-BR-19) — kiểm trước khi gửi, server vẫn kiểm lại. */
function validate(v) {
  const days = v.reminderDays
  const filled = days.filter((d) => d !== null && d !== undefined)
  let error = null
  if (filled.length !== days.length) error = 'Nhập số ngày hoặc xóa ô trống.'
  else if (filled.some((d) => d < MIN_DAY || d > MAX_DAY)) error = `Mỗi mốc từ ${MIN_DAY} đến ${MAX_DAY} ngày.`
  else if (filled.some((d, i) => i > 0 && d <= filled[i - 1])) error = 'Các mốc phải tăng dần và không trùng nhau.'
  return { reminderDays: error }
}

/**
 * Tab Thông báo của khu (notifications.md): gửi thông báo chung (AnnouncementsSection), bật "tự gửi phiếu khi chốt" và các mốc nhắc nợ sau hạn nộp.
 * Mặc định tắt — khu nào muốn phải bật. Lưu qua PUT /properties/{id}/notification-settings (không đi cùng tab Kỳ thu).
 */
export function NotificationSettingsTab({ property }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const channels = useNotificationChannels()
  const billing = property.billing
  const form = useForm(
    { notifyOnFinalize: billing.notifyOnFinalize ?? false, reminderDays: billing.overdueReminderDays ?? [] },
    { validate, codeFields: { INVALID_REMINDER_DAYS: 'reminderDays' } },
  )
  const days = form.values.reminderDays
  const setDay = (index, value) => form.setValue('reminderDays', days.map((d, i) => (i === index ? value : d)))

  const submit = form.handleSubmit(async (v) => {
    await notificationsApi.updateSettings(property.id, { notifyOnFinalize: v.notifyOnFinalize, overdueReminderDays: v.reminderDays })
    await invalidate(queryKeys.properties.detail(property.id), queryKeys.properties.all)
    toast.success('Đã lưu cài đặt thông báo.')
  })

  const none = channels.isSuccess && !channels.data.zalo.configured && !channels.data.email.configured
  return (
    <>
      <AnnouncementsSection property={property} />
      <div style={{ height: 'var(--space-6)' }} />
      <form onSubmit={submit} noValidate>
        {none && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert tone="warning">Máy chủ chưa cấu hình Zalo Bot hay email — cài đặt vẫn lưu được nhưng chưa có tin nào đi. Liên hệ người vận hành.</Alert>
          </div>
        )}
        {form.formError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert>{form.formError}</Alert>
          </div>
        )}
        <FormSection title="Tự gửi phiếu" description="Người đứng tên hợp đồng nhận phiếu qua Zalo (đã liên kết) và email (nếu có) ngay khi chốt. Tin tự động chỉ đi trong 08:00–20:00.">
          <CheckboxField
            label="Tự gửi phiếu khi chốt"
            description="Tắt: không có tin nào tự đi — vẫn bấm “Gửi lại” thủ công ở từng phiếu được."
            {...form.field('notifyOnFinalize', { type: 'checkbox' })}
          />
        </FormSection>
        <FormSection title="Nhắc nợ" description="Phiếu quá hạn mà còn nợ thì nhắc sau hạn nộp N ngày. Tối đa 3 mốc; để trống = không nhắc.">
          <div style={{ display: 'grid', gap: 'var(--space-3)', maxWidth: 320 }}>
            {days.map((day, index) => (
              <div key={index} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                <NumberField label={`Nhắc lần ${index + 1}`} suffix="ngày sau hạn" value={day} onChange={(n) => setDay(index, n)} style={{ flex: 1 }} />
                <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue('reminderDays', days.filter((_, i) => i !== index))}>
                  Xóa
                </Button>
              </div>
            ))}
            {form.errors.reminderDays && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{form.errors.reminderDays}</p>}
            {days.length < MAX_STEPS && (
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={() => form.setValue('reminderDays', [...days, days.length ? Math.min((days.at(-1) ?? 0) + 2, MAX_DAY) : 1])}>
                  Thêm mốc nhắc
                </Button>
              </div>
            )}
          </div>
        </FormSection>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
          <Button type="submit" loading={form.submitting} disabled={property.isArchived}>
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </>
  )
}
