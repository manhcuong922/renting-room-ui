import { useQuery } from '@tanstack/react-query'
import { KeyRound, Lock, LockOpen, Pencil, UserMinus, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { membersApi, queryKeys } from '@/api'
import {
  Badge,
  Button,
  CheckboxField,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  QueryView,
  StatusBadge,
  TempPasswordDialog,
  Toolbar,
} from '@/components/ui'
import { ROLE_LABELS, USER_STATUS } from '@/constants/enums'
import { Can } from '@/features/auth/access'
import { usePermission } from '@/features/auth/AuthContext'
import { Permission } from '@/features/auth/permissions'
import { useAction } from '@/hooks/useAction'
import { formatDateTime } from '@/lib/format'
import { MemberFormDialog } from '../components/MemberFormDialog'

const isPast = (iso) => Boolean(iso) && Date.parse(iso) <= Date.now()

function ActivationBadge({ member }) {
  if (!member.mustChangePassword) return null
  const expired = isPast(member.tempPasswordExpiresAt)
  return expired ? (
    <Badge tone="danger">Mật khẩu tạm đã hết hạn</Badge>
  ) : (
    <Badge tone="warning">Chờ kích hoạt (hết hạn {formatDateTime(member.tempPasswordExpiresAt)})</Badge>
  )
}

// docs/api/members.md — xem: chủ trọ + phó quản lý; thao tác: chỉ chủ trọ (ẩn nút với phó quản lý).
export default function MembersPage() {
  const [includeRemoved, setIncludeRemoved] = useState(false)
  const [editing, setEditing] = useState(null) // null | 'new' | member
  const [confirm, setConfirm] = useState(null) // { type: 'lock'|'remove', member }
  const [tempPassword, setTempPassword] = useState(null)
  const canManage = usePermission(Permission.MembersManage)

  const query = useQuery({
    queryKey: queryKeys.members.list({ includeRemoved }),
    queryFn: ({ signal }) => membersApi.list({ includeRemoved: includeRemoved || undefined }, { signal }),
  })

  const invalidate = [queryKeys.members.all]
  const lock = useAction({ mutationFn: (id) => membersApi.lock(id), invalidate, success: 'Đã khóa phó quản lý', toastErrors: false })
  const remove = useAction({ mutationFn: (id) => membersApi.remove(id), invalidate, success: 'Đã gỡ khỏi tổ chức', toastErrors: false })
  const unlock = useAction({ mutationFn: (id) => membersApi.unlock(id), invalidate, success: 'Đã mở khóa' })
  const resetPassword = useAction({ mutationFn: (id) => membersApi.resetPassword(id), invalidate, onSuccess: setTempPassword })

  const columns = [
    {
      key: 'name',
      header: 'Họ tên',
      primary: true,
      cell: (m) => (
        <div>
          <strong>{m.fullName}</strong>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{[m.phone, m.email].filter(Boolean).join(' · ')}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Vai trò', cell: (m) => ROLE_LABELS[m.role] ?? m.role },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (m) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
          <StatusBadge map={USER_STATUS} value={m.status} />
          <ActivationBadge member={m} />
        </span>
      ),
    },
    { key: 'lastLogin', header: 'Đăng nhập cuối', cell: (m) => (m.lastLoginAt ? formatDateTime(m.lastLoginAt) : 'Chưa đăng nhập') },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      hideOnMobile: !canManage,
      cell: (m) =>
        // Dòng chủ trọ / người đã gỡ: không có thao tác.
        m.role === 'OrgOwner' || m.status === 'Removed' ? null : (
          <Can permission={Permission.MembersManage}>
            <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(m)}>
                Sửa
              </Button>
              <Button size="sm" variant="secondary" icon={KeyRound} loading={resetPassword.isPending && resetPassword.variables === m.id} onClick={() => resetPassword.mutate(m.id)}>
                Cấp lại mật khẩu
              </Button>
              {m.status === 'Active' ? (
                <Button size="sm" variant="secondary" icon={Lock} onClick={() => setConfirm({ type: 'lock', member: m })}>
                  Khóa
                </Button>
              ) : (
                <Button size="sm" variant="secondary" icon={LockOpen} loading={unlock.isPending && unlock.variables === m.id} onClick={() => unlock.mutate(m.id)}>
                  Mở khóa
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={UserMinus} onClick={() => setConfirm({ type: 'remove', member: m })}>
                Gỡ
              </Button>
            </span>
          </Can>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Thành viên"
        description={canManage ? 'Quản lý phó quản lý của tổ chức.' : 'Bạn chỉ có quyền xem danh sách thành viên.'}
        actions={
          <Can permission={Permission.MembersManage}>
            <Button icon={UserPlus} onClick={() => setEditing('new')}>
              Thêm phó quản lý
            </Button>
          </Can>
        }
      />

      <Toolbar>
        <CheckboxField label="Hiện cả người đã gỡ" checked={includeRemoved} onChange={(e) => setIncludeRemoved(e.target.checked)} />
      </Toolbar>

      <QueryView query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState icon={Users} title="Chưa có thành viên" />}>
        {(members) => <DataTable columns={columns} rows={members} caption="Thành viên tổ chức" />}
      </QueryView>

      {editing && (
        <MemberFormDialog
          open
          member={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={(result) => {
            setEditing(null)
            setTempPassword(result)
          }}
        />
      )}
      <ConfirmDialog
        open={confirm?.type === 'lock'}
        onClose={() => setConfirm(null)}
        title={`Khóa ${confirm?.member?.fullName ?? ''}?`}
        message="Phó quản lý sẽ bị đăng xuất ngay."
        confirmLabel="Khóa"
        tone="danger"
        onConfirm={() => lock.mutateAsync(confirm.member.id)}
      />
      <ConfirmDialog
        open={confirm?.type === 'remove'}
        onClose={() => setConfirm(null)}
        title="Gỡ khỏi tổ chức?"
        message="Gỡ vĩnh viễn, không khôi phục được. Tài khoản bị đăng xuất và không đăng nhập lại được."
        confirmText={confirm?.member?.fullName}
        confirmLabel="Gỡ vĩnh viễn"
        tone="danger"
        onConfirm={() => remove.mutateAsync(confirm.member.id)}
      />
      <TempPasswordDialog title="Mật khẩu tạm của phó quản lý" data={tempPassword} onClose={() => setTempPassword(null)} />
    </>
  )
}
