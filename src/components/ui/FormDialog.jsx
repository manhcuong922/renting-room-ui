import { useId } from 'react'
import { useForm } from '@/hooks/useForm'
import { Button } from './Button'
import { Alert } from './Feedback'
import { Modal } from './Modal'

/**
 * Hộp thoại form chuẩn: tiêu đề + nội dung form + Hủy / Lưu. Lỗi server tự gắn vào ô (useForm).
 *
 *   <FormDialog title="Gia hạn" initial={{ newEndDate: '' }} validate={…}
 *               onSubmit={(v) => api.extend(id, v)} onClose={…}>
 *     {(form) => <DateField label="Ngày kết thúc mới" {...form.field('newEndDate')} />}
 *   </FormDialog>
 *
 * onSubmit ném lỗi → hiện trong hộp thoại; thành công → onClose() (trừ khi onSubmit trả về false).
 */
export function FormDialog({
  title,
  description,
  initial,
  validate,
  codeFields,
  serverPrefix,
  onSubmit,
  onClose,
  submitLabel = 'Lưu',
  tone = 'primary',
  size = 'sm',
  children,
}) {
  const formId = useId()
  const form = useForm(initial, { validate, codeFields, serverPrefix })

  const submit = form.handleSubmit(async (values) => {
    const result = await onSubmit(values, form)
    if (result !== false) onClose()
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form={formId} variant={tone === 'danger' ? 'danger' : 'primary'} loading={form.submitting}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {form.formError && <Alert>{form.formError}</Alert>}
        {children(form)}
      </form>
    </Modal>
  )
}
