import { useId, useState } from 'react'
import { getErrorMessage } from '@/lib/http/ApiError'
import { Button } from './Button'
import { Alert } from './Feedback'
import { TextAreaField, TextField } from './Fields'
import { Modal } from './Modal'

/**
 * Hộp xác nhận thao tác.
 *  - `reasonLabel` → ô lý do/ghi chú, onConfirm(reason) (VD tạm ngưng tổ chức). `reasonRequired={false}` → không bắt buộc.
 *  - `confirmText` → xác nhận mạnh: phải gõ đúng chuỗi (VD gỡ thành viên — không hoàn tác).
 * onConfirm trả promise; lỗi hiện ngay trong hộp thoại, thành công thì tự đóng.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Xác nhận',
  tone = 'primary',
  reasonLabel,
  reasonRequired = true,
  reasonMaxLength = 500,
  confirmText,
  children,
}) {
  const formId = useId()
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const close = () => {
    if (busy) return
    setReason('')
    setTyped('')
    setError(null)
    onClose()
  }

  const canConfirm = (!reasonLabel || !reasonRequired || reason.trim()) && (!confirmText || typed.trim() === confirmText)

  const submit = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!canConfirm) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      setBusy(false)
      setReason('')
      setTyped('')
      onClose()
    } catch (err) {
      setBusy(false)
      setError(getErrorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" form={formId} variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} disabled={!canConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {error && <Alert>{error}</Alert>}
        {message && <p style={{ color: 'var(--color-text-muted)' }}>{message}</p>}
        {children}
        {reasonLabel && (
          <TextAreaField
            label={reasonLabel}
            required={reasonRequired}
            rows={3}
            maxLength={reasonMaxLength}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
        {confirmText && (
          <TextField
            label={`Gõ "${confirmText}" để xác nhận`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        )}
      </form>
    </Modal>
  )
}
