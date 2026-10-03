import { KeyRound, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, Button, TextField } from '@/components/ui'
import { getErrorMessage } from '@/lib/http/ApiError'
import { useAuth } from '../AuthContext'
import styles from './AuthPages.module.css'

const SESSION_MESSAGES = {
  SESSION_REVOKED: 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.',
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  INVALID_REFRESH_TOKEN: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  INVALID_TOKEN: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  AUTHENTICATION_REQUIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  ACCOUNT_LOCKED: 'Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.',
  ORGANIZATION_SUSPENDED: 'Tổ chức của bạn đang bị tạm ngưng. Liên hệ quản trị viên.',
}

const LOGIN_MESSAGES = {
  TEMPORARY_PASSWORD_EXPIRED: 'Mật khẩu tạm đã hết hạn (quá 72 giờ). Liên hệ người cấp tài khoản để được cấp lại.',
  ORGANIZATION_SUSPENDED: 'Tổ chức của bạn đang bị tạm ngưng. Liên hệ quản trị viên.',
}

export default function LoginPage() {
  const { login, endReason } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [cooldown, setCooldown] = useState(0)

  // 429: khóa nút trong Retry-After giây.
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }))

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ username: form.username.trim(), password: form.password })
      // GuestOnly tự điều hướng khi đã đăng nhập.
    } catch (err) {
      setError(err)
      if (err.status === 429) setCooldown(err.retryAfter ?? 60)
      setSubmitting(false)
    }
  }

  const sessionNotice = !error && endReason && SESSION_MESSAGES[endReason.code]
  const errorMessage = error && (LOGIN_MESSAGES[error.code] ?? getErrorMessage(error))

  return (
    <>
      <h1 className={styles.title}>Đăng nhập</h1>
      <p className={styles.subtitle}>Dùng số điện thoại hoặc email đã được cấp.</p>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {sessionNotice && <Alert tone="warning">{sessionNotice}</Alert>}
        {errorMessage && <Alert>{errorMessage}</Alert>}

        <TextField
          label="Số điện thoại hoặc email"
          icon={User}
          name="username"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={form.username}
          onChange={update('username')}
          error={error?.fieldErrors().username}
        />
        <TextField
          label="Mật khẩu"
          icon={KeyRound}
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={form.password}
          onChange={update('password')}
          error={error?.fieldErrors().password}
        />
        <label className={styles.checkbox}>
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          Hiện mật khẩu
        </label>

        <Button
          type="submit"
          size="lg"
          block
          loading={submitting}
          disabled={!form.username.trim() || !form.password || cooldown > 0}
        >
          {cooldown > 0 ? `Thử lại sau ${cooldown}s` : 'Đăng nhập'}
        </Button>
      </form>
    </>
  )
}
