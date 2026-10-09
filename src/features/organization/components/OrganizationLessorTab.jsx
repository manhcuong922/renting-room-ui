import { organizationApi, queryKeys } from '@/api'
import { Alert, QueryView, useToast } from '@/components/ui'
import { useCanViewSensitiveData, usePermission } from '@/features/auth/AuthContext'
import { Permission } from '@/features/auth/permissions'
import { LessorForm, LessorSummary } from '@/features/properties/components/LessorForm'
import { useInvalidate } from '@/hooks/useAction'
import { useOrganizationLessor } from '../hooks'

/**
 * Thông tin chủ trọ làm bên cho thuê — khai 1 lần, mọi khu không khai riêng dùng chung (docs/api/properties.md#bên-cho-thuê).
 * Chỉ chủ trọ sửa (PUT /org/lessor); phó quản lý chỉ xem. Lần đầu điền sẵn từ thông tin liên hệ của tổ chức (`prefill`).
 */
export function OrganizationLessorTab() {
  const toast = useToast()
  const invalidate = useInvalidate()
  const canManage = usePermission(Permission.OrganizationSettingsManage)
  const canViewSensitive = useCanViewSensitiveData()
  const query = useOrganizationLessor()
  const reveal = canViewSensitive ? () => organizationApi.revealLessorIdNumber() : undefined

  return (
    <QueryView query={query} loading="page" errorTitle="Không tải được thông tin chủ trọ">
      {({ lessor, prefill }) => (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Alert tone="info">
            Bên cho thuê (bên A) in trên hợp đồng của mọi khu. Khu do người khác đứng tên (công ty quản lý, người được ủy quyền) thì khai riêng ở
            tab Bên cho thuê của khu đó. Sửa ở đây không ảnh hưởng hợp đồng đã kích hoạt.
          </Alert>
          {lessor && !lessor.isComplete && <Alert tone="warning">Chưa đủ thông tin — chưa in được hợp đồng đầy đủ.</Alert>}
          {canManage ? (
            <LessorForm
              key={JSON.stringify(lessor)}
              lessor={lessor}
              prefill={lessor ? null : prefill}
              onReveal={lessor ? reveal : undefined}
              submitLabel="Lưu thông tin chủ trọ"
              onSave={async (body) => {
                await organizationApi.updateLessor(body)
                await invalidate(queryKeys.organization.lessor, queryKeys.properties.all)
                toast.success('Đã lưu thông tin chủ trọ.')
              }}
            />
          ) : lessor ? (
            <LessorSummary lessor={lessor} onReveal={reveal} />
          ) : (
            <Alert tone="warning">Chủ trọ chưa khai thông tin bên cho thuê. Chỉ chủ trọ khai được.</Alert>
          )}
        </div>
      )}
    </QueryView>
  )
}
