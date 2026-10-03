import { useState } from 'react'
import { Alert, Button, TextField } from '@/components/ui'
import { getErrorMessage } from '@/lib/http/ApiError'
import { useAuth } from '../AuthContext'
import styles from '../pages/AuthPages.module.css'

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

// Quy tắc khớp server (docs/api/auth.md#đổi-mật-khẩu).
function validate(values, user) {
  const errors = {}
  const pwd = values.newPassword
  if (!values.currentPassword) errors.currentPassword = 'Nhập mật khẩu hiện tại.'
  if (pwd.length < 8 || pwd.length > 128) errors.newPassword = 'Mật khẩu mới dài 8–128 ký tự.'
  else if (!/\p{L}/u.test(pwd) || !/\d/.test(pwd)) errors.newPassword = 'Mật khẩu mới phải có cả chữ và số.'
  else if ([user?.phone, user?.email].some((name) => name && pwd.toLowerCase().includes(name.toLowerCase())))
    errors.newPassword = 'Mật khẩu không được chứa tên đăng nhập.'
  else if (pwd === values.currentPassword) errors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
  if (values.confirmPassword !== pwd) errors.confirmPassword = 'Mật khẩu nhập lại không khớp.'
  return errors
}

// Ánh xạ lỗi server → ô tương ứng.
function serverErrors(error) {
  const fields = error.fieldErrors()
  if (error.code === 'WEAK_PASSWORD' || error.code === 'PASSWORD_REUSED') fields.newPassword ??= error.detail
  if (error.code === 'INVALID_CURRENT_PASSWORD') fields.currentPassword ??= error.detail
  return fields
}

export function ChangePasswordForm({ onSuccess, submitLabel = 'Đổi mật khẩu' }) {
  const { user, changePassword } = useAuth()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }))

  const onSubmit = async (event) => {
    event.preventDefault()
    const clientErrors = validate(values, user)
    setErrors(clientErrors)
    setFormError(null)
    if (Object.keys(clientErrors).length) return

    setSubmitting(true)
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      setValues(EMPTY)
      onSuccess?.()
    } catch (error) {
      const fields = serverErrors(error)
      setErrors(fields)
      if (!Object.keys(fields).length) setFormError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {formError && <Alert>{formError}</Alert>}
      <TextField
        label="Mật khẩu hiện tại"
        type="password"
        autoComplete="current-password"
        value={values.currentPassword}
        onChange={update('currentPassword')}
        error={errors.currentPassword}
      />
      <TextField
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        hint="8–128 ký tự, có cả chữ và số, không chứa tên đăng nhập."
        value={values.newPassword}
        onChange={update('newPassword')}
        error={errors.newPassword}
      />
      <TextField
        label="Nhập lại mật khẩu mới"
        type="password"
        autoComplete="new-password"
        value={values.confirmPassword}
        onChange={update('confirmPassword')}
        error={errors.confirmPassword}
      />
      <Button type="submit" size="lg" block loading={submitting}>
        {submitLabel}
      </Button>
    </form>
  )
}
