import { useState } from 'react'
import { Alert, Badge, Card, PageHeader } from '@/components/ui'
import { ROLE_LABELS } from '@/constants/enums'
import { useAuth } from '@/features/auth/AuthContext'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'
import { formatDateTime } from '@/lib/format'
import styles from './ProfilePage.module.css'

// Hồ sơ của tôi — GET /me + đổi mật khẩu (docs/api/auth.md#hồ-sơ-của-tôi).
export default function ProfilePage() {
  const { user } = useAuth()
  const [changed, setChanged] = useState(false)

  const rows = [
    ['Họ tên', user.fullName],
    ['Số điện thoại', user.phone || '—'],
    ['Email', user.email || '—'],
    ['Vai trò', <Badge key="role" tone="primary">{ROLE_LABELS[user.role] ?? user.role}</Badge>],
    ['Tổ chức', user.organization ? `${user.organization.name} (${user.organization.code})` : '—'],
    ['Đăng nhập gần nhất', formatDateTime(user.lastLoginAt)],
  ]

  return (
    <>
      <PageHeader title="Hồ sơ của tôi" />
      <div className={styles.layout}>
        <Card>
          <h2 className={styles.sectionTitle}>Thông tin tài khoản</h2>
          <dl className={styles.list}>
            {rows.map(([label, value]) => (
              <div key={label} className={styles.row}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <h2 className={styles.sectionTitle}>Đổi mật khẩu</h2>
          {changed && <Alert tone="info">Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.</Alert>}
          <ChangePasswordForm onSuccess={() => setChanged(true)} />
        </Card>
      </div>
    </>
  )
}
