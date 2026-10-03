import { Alert } from '@/components/ui'
import { useAuth } from '../AuthContext'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import styles from './AuthPages.module.css'

// Màn đổi mật khẩu bắt buộc (mustChangePassword = true). Đổi xong RequireAuth tự đưa về trang chủ.
export default function ChangePasswordPage() {
  const { user, logout } = useAuth()

  return (
    <>
      <h1 className={styles.title}>Đổi mật khẩu</h1>
      <p className={styles.subtitle}>Xin chào {user?.fullName}, bạn cần đặt mật khẩu mới trước khi tiếp tục.</p>
      <div style={{ marginTop: 'var(--space-4)' }}>
        <Alert tone="info">Sau khi đổi, các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</Alert>
      </div>
      <ChangePasswordForm submitLabel="Đặt mật khẩu mới" />
      <div className={styles.footer}>
        <button type="button" className={styles.linkButton} onClick={logout}>
          Đăng xuất
        </button>
      </div>
    </>
  )
}
