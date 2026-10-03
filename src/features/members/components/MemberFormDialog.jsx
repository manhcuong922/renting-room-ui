import { membersApi, queryKeys } from '@/api'
import { Alert, Button, FormGrid, Modal, TextField } from '@/components/ui'
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

/** Thêm (member = null) hoặc sửa phó quản lý. Thêm xong → onCreated({ username, temporaryPassword, expiresAt }). */
export function MemberFormDialog({ open, member, onClose, onCreated }) {
  const editing = Boolean(member)
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const form = useForm(toForm(member), {
    validate,
    codeFields: { PHONE_TAKEN: 'phone', EMAIL_TAKEN: 'email' },
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
      onClose()
    } else {
      const result = await membersApi.create(body, { idempotencyKey: idem.keyFor(body) })
      await invalidate(queryKeys.members.all)
      idem.reset()
      onCreated(result)
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? 'Sửa phó quản lý' : 'Thêm phó quản lý'}
      description={editing ? 'Đổi SĐT/email thì tên đăng nhập đổi theo.' : 'SĐT hoặc email là tên đăng nhập. Mật khẩu tạm hiện một lần sau khi thêm.'}
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
        </FormGrid>
      </form>
    </Modal>
  )
}
