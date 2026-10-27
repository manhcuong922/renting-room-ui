import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, PageHeader, useToast } from '@/components/ui'
import { ROLE_LABELS } from '@/constants/enums'
import { useAuth } from '@/features/auth/AuthContext'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'
import { canEditOwnProfile } from '@/features/auth/permissions'
import { formatDateTime } from '@/lib/format'
import { ProfileEditDialog } from '../components/ProfileEditDialog'
import styles from './ProfilePage.module.css'

// Hồ sơ của tôi — GET /me, PUT /me (chủ trọ / SystemAdmin) + đổi mật khẩu (docs/api/auth.md#hồ-sơ-của-tôi).
export default function ProfilePage() {
  const { user } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const canEdit = canEditOwnProfile(user)

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
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Thông tin tài khoản</h2>
            {canEdit && (
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                Sửa
              </Button>
            )}
          </div>
          <dl className={styles.list}>
            {rows.map(([label, value]) => (
              <div key={label} className={styles.row}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {!canEdit && <p className={styles.note}>Phó quản lý không tự sửa hồ sơ — liên hệ chủ trọ để đổi thông tin.</p>}
        </Card>
        <Card>
          <h2 className={styles.sectionTitle}>Đổi mật khẩu</h2>
          <ChangePasswordForm onSuccess={() => toast.success('Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.')} />
        </Card>
      </div>
      {editing && <ProfileEditDialog onClose={() => setEditing(false)} />}
    </>
  )
}
