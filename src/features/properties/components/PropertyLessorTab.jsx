import { useState } from 'react'
import { Link } from 'react-router'
import { propertiesApi, queryKeys } from '@/api'
import { Alert, Button, ConfirmDialog, useToast } from '@/components/ui'
import { useCanViewSensitiveData } from '@/features/auth/AuthContext'
import { useInvalidate } from '@/hooks/useAction'
import { LessorForm, LessorSummary } from './LessorForm'

const ORG_LESSOR_PATH = '/organization?tab=lessor'

function CompletenessAlert({ lessor }) {
  if (lessor?.isComplete) return <Alert tone="info">Đã đủ thông tin bên cho thuê — in được hợp đồng đầy đủ.</Alert>
  return (
    <Alert tone="warning">
      Chưa đủ thông tin bên cho thuê — chưa in được hợp đồng đầy đủ (không chặn kích hoạt hay thu tiền).
    </Alert>
  )
}

/**
 * Tab Bên cho thuê của khu (docs/api/properties.md#bên-cho-thuê). Mặc định khu dùng **thông tin chủ trọ** (khai 1 lần ở
 * Cài đặt tổ chức, `lessorInherited: true`). Chỉ khai riêng khi khác chủ trọ (công ty quản lý, người được ủy quyền).
 * Sửa / bỏ không ảnh hưởng HĐ đã kích hoạt (HĐ giữ bản chụp lúc kích hoạt).
 */
export function PropertyLessorTab({ property }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const canViewSensitive = useCanViewSensitiveData()
  const [editingOwn, setEditingOwn] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const { lessor, lessorInherited } = property
  const usesOwn = lessor && !lessorInherited
  const reveal = canViewSensitive ? () => propertiesApi.revealLessorIdNumber(property.id) : undefined

  const refresh = () => invalidate(queryKeys.properties.detail(property.id), queryKeys.properties.all)

  const save = async (body) => {
    await propertiesApi.updateLessor(property.id, body)
    await refresh()
    setEditingOwn(false)
    toast.success('Đã lưu bên cho thuê riêng của khu.')
  }

  if (usesOwn || editingOwn) {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <Alert tone="info">
          Khu này khai <strong>bên cho thuê riêng</strong> (khác chủ trọ). Các khu khác dùng{' '}
          <Link to={ORG_LESSOR_PATH}>thông tin chủ trọ</Link>.
        </Alert>
        {usesOwn && <CompletenessAlert lessor={lessor} />}
        <LessorForm
          lessor={usesOwn ? lessor : null}
          onSave={save}
          onReveal={usesOwn ? reveal : undefined}
          submitLabel="Lưu bên cho thuê riêng"
          extraActions={
            usesOwn ? (
              <Button variant="ghost" onClick={() => setConfirmClear(true)}>
                Bỏ khai riêng, dùng thông tin chủ trọ
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setEditingOwn(false)}>
                Hủy
              </Button>
            )
          }
        />
        <ConfirmDialog
          open={confirmClear}
          onClose={() => setConfirmClear(false)}
          title="Dùng thông tin chủ trọ cho khu này?"
          message="Xóa bên cho thuê riêng của khu. Hợp đồng đã kích hoạt vẫn giữ thông tin cũ."
          confirmLabel="Bỏ khai riêng"
          tone="danger"
          onConfirm={async () => {
            await propertiesApi.clearLessor(property.id)
            await refresh()
            toast.success('Khu đã dùng thông tin chủ trọ.')
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {lessor ? (
        <>
          <Alert tone="info">
            Khu đang dùng <strong>thông tin chủ trọ</strong> làm bên cho thuê. Sửa ở <Link to={ORG_LESSOR_PATH}>Cài đặt tổ chức → Thông tin chủ trọ</Link>.
          </Alert>
          <CompletenessAlert lessor={lessor} />
          <LessorSummary lessor={lessor} onReveal={reveal} />
        </>
      ) : (
        <Alert tone="warning">
          Chưa khai thông tin chủ trọ — chưa in được hợp đồng đầy đủ. Khai một lần ở{' '}
          <Link to={ORG_LESSOR_PATH}>Cài đặt tổ chức → Thông tin chủ trọ</Link> để dùng cho mọi khu.
        </Alert>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={() => setEditingOwn(true)} disabled={property.isArchived}>
          Khai riêng cho khu này
        </Button>
      </div>
    </div>
  )
}
