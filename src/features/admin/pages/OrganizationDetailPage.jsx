import { KeyRound, Lock, LockOpen, Pause, Play } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { adminApi, queryKeys } from '@/api'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  PageHeader,
  QueryView,
  Section,
  StatusBadge,
  TempPasswordDialog,
} from '@/components/ui'
import { ORGANIZATION_STATUS, ROLE_LABELS, USER_STATUS } from '@/constants/enums'
import { useAction } from '@/hooks/useAction'
import { formatDateTime } from '@/lib/format'
import { useOrganization } from '../hooks'

// docs/api/admin.md#chi-tiết-tổ-chức
export default function OrganizationDetailPage() {
  const { id } = useParams()
  const query = useOrganization(id)
  const [dialog, setDialog] = useState(null) // { type: 'suspend'|'reactivate'|'lock', user? }
  const [tempPassword, setTempPassword] = useState(null)

  const invalidate = [queryKeys.organizations.detail(id), queryKeys.organizations.all]
  const suspend = useAction({ mutationFn: (reason) => adminApi.suspendOrganization(id, { reason }), invalidate, success: 'Đã tạm ngưng tổ chức', toastErrors: false })
  const reactivate = useAction({ mutationFn: () => adminApi.reactivateOrganization(id), invalidate, success: 'Đã kích hoạt lại tổ chức', toastErrors: false })
  const lock = useAction({ mutationFn: (userId) => adminApi.lockUser(userId), invalidate, success: 'Đã khóa tài khoản', toastErrors: false })
  const unlock = useAction({ mutationFn: (userId) => adminApi.unlockUser(userId), invalidate, success: 'Đã mở khóa tài khoản' })
  const resetPassword = useAction({
    mutationFn: (userId) => adminApi.resetUserPassword(userId),
    invalidate,
    onSuccess: (data) => setTempPassword(data),
  })

  return (
    <QueryView query={query} loading="page" errorTitle="Không tải được tổ chức">
      {(org) => {
        const suspended = org.status === 'Suspended'
        const userColumns = [
          {
            key: 'name',
            header: 'Tài khoản',
            primary: true,
            cell: (u) => (
              <div>
                <strong>{u.fullName}</strong>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{u.phone || u.email}</div>
              </div>
            ),
          },
          { key: 'role', header: 'Vai trò', cell: (u) => ROLE_LABELS[u.role] ?? u.role },
          {
            key: 'status',
            header: 'Trạng thái',
            cell: (u) => (
              <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                <StatusBadge map={USER_STATUS} value={u.status} />
                {u.mustChangePassword && <Badge tone="warning">Chưa đổi mật khẩu tạm</Badge>}
              </span>
            ),
          },
          { key: 'lastLogin', header: 'Đăng nhập cuối', cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Chưa đăng nhập') },
          {
            key: 'actions',
            header: 'Thao tác',
            align: 'right',
            cell: (u) =>
              u.status === 'Removed' ? null : (
                <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                  <Button size="sm" variant="secondary" icon={KeyRound} loading={resetPassword.isPending && resetPassword.variables === u.id} onClick={() => resetPassword.mutate(u.id)}>
                    Cấp lại mật khẩu
                  </Button>
                  {/* Chủ trọ không khóa được (CANNOT_LOCK_OWNER) → dùng tạm ngưng tổ chức. */}
                  {u.role === 'OrgManager' && u.status === 'Active' && (
                    <Button size="sm" variant="secondary" icon={Lock} onClick={() => setDialog({ type: 'lock', user: u })}>
                      Khóa
                    </Button>
                  )}
                  {u.status === 'Locked' && (
                    <Button size="sm" variant="secondary" icon={LockOpen} loading={unlock.isPending && unlock.variables === u.id} onClick={() => unlock.mutate(u.id)}>
                      Mở khóa
                    </Button>
                  )}
                </span>
              ),
          },
        ]

        return (
          <>
            <PageHeader
              backTo="/admin/organizations"
              backLabel="Tổ chức chủ trọ"
              title={org.name}
              meta={
                <>
                  <Badge tone="primary">{org.code}</Badge>
                  <StatusBadge map={ORGANIZATION_STATUS} value={org.status} />
                </>
              }
              actions={
                suspended ? (
                  <Button icon={Play} onClick={() => setDialog({ type: 'reactivate' })}>
                    Kích hoạt lại
                  </Button>
                ) : (
                  <Button variant="danger" icon={Pause} onClick={() => setDialog({ type: 'suspend' })}>
                    Tạm ngưng
                  </Button>
                )
              }
            />

            {suspended && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Alert>
                  <strong>Tổ chức đang tạm ngưng.</strong> Mọi tài khoản không đăng nhập được.
                  {org.suspendedReason && <> Lý do: {org.suspendedReason}</>}
                </Alert>
              </div>
            )}

            <Section title="Thông tin tổ chức">
              <DescriptionList
                items={[
                  { label: 'Người liên hệ', value: org.contactName },
                  { label: 'SĐT liên hệ', value: org.contactPhone },
                  { label: 'Email liên hệ', value: org.contactEmail },
                  { label: 'Mã số thuế', value: org.taxCode },
                  { label: 'Ngày tạo', value: formatDateTime(org.createdAt) },
                  { label: 'Ghi chú', value: org.note, full: true },
                ]}
              />
            </Section>

            <Section title="Tài khoản" description="Chủ trọ và các phó quản lý của tổ chức." padded={false}>
              <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
                <DataTable columns={userColumns} rows={org.users} caption="Tài khoản trong tổ chức" />
              </div>
            </Section>

            <ConfirmDialog
              open={dialog?.type === 'suspend'}
              onClose={() => setDialog(null)}
              title="Tạm ngưng tổ chức?"
              message="Mọi tài khoản trong tổ chức bị đăng xuất ngay và không đăng nhập được cho tới khi kích hoạt lại."
              reasonLabel="Lý do tạm ngưng"
              confirmLabel="Tạm ngưng"
              tone="danger"
              onConfirm={(reason) => suspend.mutateAsync(reason)}
            />
            <ConfirmDialog
              open={dialog?.type === 'reactivate'}
              onClose={() => setDialog(null)}
              title="Kích hoạt lại tổ chức?"
              message="Các tài khoản trong tổ chức đăng nhập lại được."
              confirmLabel="Kích hoạt lại"
              onConfirm={() => reactivate.mutateAsync()}
            />
            <ConfirmDialog
              open={dialog?.type === 'lock'}
              onClose={() => setDialog(null)}
              title={`Khóa tài khoản ${dialog?.user?.fullName ?? ''}?`}
              message="Phó quản lý bị đăng xuất ngay và không đăng nhập được cho tới khi mở khóa."
              confirmLabel="Khóa"
              tone="danger"
              onConfirm={() => lock.mutateAsync(dialog.user.id)}
            />
            <TempPasswordDialog title="Mật khẩu tạm mới" data={tempPassword} onClose={() => setTempPassword(null)} />
          </>
        )
      }}
    </QueryView>
  )
}
