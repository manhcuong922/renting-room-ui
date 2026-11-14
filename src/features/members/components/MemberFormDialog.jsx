import { useState } from 'react'
import { membersApi, queryKeys } from '@/api'
import { Alert, Button, CheckboxGroup, FormGrid, Modal, TextField, useToast } from '@/components/ui'
import { usePropertyOptions } from '@/features/shared/queries'
import { useInvalidate } from '@/hooks/useAction'
import { cleanStrings, useForm } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'

function validate(v) {
  return {
    fullName: !v.fullName.trim() ? 'Nhập họ tên.' : null,
    phone: !v.phone.trim() && !v.email.trim() ? 'Cần SĐT hoặc email (là tên đăng nhập).' : null,
  }
}

const toForm = (m) => ({ fullName: m?.fullName ?? '', phone: m?.phone ?? '', email: m?.email ?? '' })

const PROPERTY_HINT = 'Quản lý khu làm mọi việc như chủ trọ nhưng chỉ trong các khu được chọn (trừ ngân hàng, bên cho thuê, tạo / ngừng khu, mẫu hợp đồng).'

/** Ô chọn khu được giao (members.md#giao-khu) — khu đang dùng của tổ chức. */
function PropertyPicker({ value, onChange, error }) {
  const properties = usePropertyOptions()
  const options = (properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))
  if (properties.isPending) return <p style={{ color: 'var(--color-text-muted)' }}>Đang tải danh sách khu…</p>
  if (options.length === 0) return <Alert tone="warning">Chưa có khu nào — tạo khu trước rồi giao cho quản lý.</Alert>
  return <CheckboxGroup label="Khu được giao" options={options} value={value} onChange={onChange} error={error} />
}

/** Thêm (member = null) hoặc sửa quản lý khu. Thêm xong → onCreated({ username, temporaryPassword, expiresAt }). */
export function MemberFormDialog({ open, member, onClose, onCreated }) {
  const editing = Boolean(member)
  const invalidate = useInvalidate()
  const toast = useToast()
  const idem = useIdempotencyKey()
  const properties = usePropertyOptions()
  // Thêm mới: mặc định chọn sẵn mọi khu (chủ trọ 1 khu khỏi phải tích); bỏ bớt nếu mỗi người quản một khu.
  const [propertyIds, setPropertyIds] = useState(null)
  const selected = propertyIds ?? (properties.data ?? []).map((p) => p.id)
  const form = useForm(toForm(member), {
    validate,
    codeFields: { PHONE_TAKEN: 'phone', EMAIL_TAKEN: 'email', PROPERTY_ASSIGNMENT_INVALID: 'propertyIds' },
  })

  const close = () => {
    if (form.submitting) return
    idem.reset()
    onClose()
  }

  const submit = form.handleSubmit(async (v) => {
    const body = cleanStrings(v)
    if (editing) {
      await membersApi.update(member.id, { ...body, version: member.version })
      await invalidate(queryKeys.members.all)
      toast.success('Đã lưu thông tin quản lý khu.')
      onClose()
    } else {
      const withProperties = { ...body, propertyIds: selected }
      const result = await membersApi.create(withProperties, { idempotencyKey: idem.keyFor(withProperties) })
      await invalidate(queryKeys.members.all)
      idem.reset()
      toast.success('Đã thêm quản lý khu.')
      onCreated(result)
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? 'Sửa quản lý khu' : 'Thêm quản lý khu'}
      description={editing ? 'Đổi SĐT/email thì tên đăng nhập đổi theo. Đổi khu được giao: nút "Giao khu".' : 'SĐT hoặc email là tên đăng nhập. Mật khẩu tạm hiện một lần sau khi thêm.'}
      size="sm"
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form="member-form" loading={form.submitting}>
            {editing ? 'Lưu' : 'Thêm'}
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} noValidate>
        <FormGrid cols={1}>
          {form.formError && <Alert>{form.formError}</Alert>}
          <TextField label="Họ tên" required maxLength={200} autoComplete="off" {...form.field('fullName')} />
          <TextField label="Số điện thoại" inputMode="tel" autoComplete="off" {...form.field('phone')} />
          <TextField label="Email" type="email" autoComplete="off" {...form.field('email')} />
          {!editing && (
            <>
              <PropertyPicker value={selected} onChange={setPropertyIds} error={form.errors.propertyIds} />
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{PROPERTY_HINT}</p>
            </>
          )}
        </FormGrid>
      </form>
    </Modal>
  )
}

/** Giao khu cho quản lý khu — thay cả danh sách, có hiệu lực ngay ở phiên đang mở của người đó (members.md#giao-khu). */
export function AssignPropertiesDialog({ member, onClose }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const [propertyIds, setPropertyIds] = useState(member.propertyIds ?? [])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await membersApi.assignProperties(member.id, propertyIds)
      await invalidate(queryKeys.members.all)
      toast.success(propertyIds.length ? `Đã giao ${propertyIds.length} khu cho ${member.fullName}.` : `${member.fullName} không còn quản lý khu nào.`)
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      title={`Giao khu — ${member.fullName}`}
      description={PROPERTY_HINT}
      size="sm"
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={save} loading={saving}>
            Lưu
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {error && <Alert>{error.detail ?? error.message}</Alert>}
        <PropertyPicker value={propertyIds} onChange={setPropertyIds} />
        {propertyIds.length === 0 && <Alert tone="warning">Không chọn khu nào ⇒ người này đăng nhập vào sẽ không thấy dữ liệu khu nào.</Alert>}
      </div>
    </Modal>
  )
}
