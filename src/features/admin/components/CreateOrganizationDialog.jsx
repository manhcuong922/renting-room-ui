import { adminApi, queryKeys } from '@/api'
import { Alert, Button, FormGrid, FormSection, Modal, TextAreaField, TextField } from '@/components/ui'
import { useInvalidate } from '@/hooks/useAction'
import { cleanStrings, useForm } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'

const EMPTY = {
  code: '',
  name: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  taxCode: '',
  address: '',
  note: '',
  owner: { fullName: '', phone: '', email: '' },
}

// Quy tắc theo docs/api/admin.md#tạo-tổ-chức — server vẫn kiểm tra lại.
function validate(v) {
  return {
    code: !/^[A-Za-z0-9-]{3,32}$/.test(v.code.trim()) ? 'Mã 3–32 ký tự: chữ, số, dấu gạch ngang.' : null,
    name: !v.name.trim() ? 'Nhập tên tổ chức.' : null,
    taxCode: v.taxCode.trim() && !/^\d{10}(-\d{3})?$/.test(v.taxCode.trim()) ? 'Mã số thuế: 10 số hoặc 10 số-3 số.' : null,
    'owner.fullName': !v.owner.fullName.trim() ? 'Nhập họ tên chủ trọ.' : null,
    'owner.phone': !v.owner.phone.trim() && !v.owner.email.trim() ? 'Cần SĐT hoặc email (là tên đăng nhập).' : null,
  }
}

export function CreateOrganizationDialog({ open, onClose, onCreated }) {
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const form = useForm(EMPTY, {
    validate,
    codeFields: { ORG_CODE_TAKEN: 'code', PHONE_TAKEN: 'owner.phone', EMAIL_TAKEN: 'owner.email' },
  })

  const close = () => {
    if (form.submitting) return
    form.reset(EMPTY)
    idem.reset()
    onClose()
  }

  const submit = form.handleSubmit(async (v) => {
    const body = { ...cleanStrings(v), code: v.code.trim().toUpperCase(), owner: cleanStrings(v.owner) }
    const result = await adminApi.createOrganization(body, { idempotencyKey: idem.keyFor(body) })
    await invalidate(queryKeys.organizations.all)
    form.reset(EMPTY)
    idem.reset()
    onCreated(result)
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title="Tạo tổ chức chủ trọ"
      description="Tạo tổ chức và tài khoản chủ trọ. Mật khẩu tạm hiện một lần sau khi tạo."
      size="lg"
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form="create-org-form" loading={form.submitting}>
            Tạo tổ chức
          </Button>
        </>
      }
    >
      <form id="create-org-form" onSubmit={submit} noValidate>
        {form.formError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert>{form.formError}</Alert>
          </div>
        )}
        <FormSection title="Tổ chức">
          <FormGrid>
            <TextField label="Mã tổ chức" required hint="Duy nhất toàn hệ thống, VD HOASEN-01" maxLength={32} {...form.field('code')} />
            <TextField label="Tên tổ chức" required maxLength={200} {...form.field('name')} />
            <TextField label="Người liên hệ" maxLength={200} {...form.field('contactName')} />
            <TextField label="SĐT liên hệ" inputMode="tel" {...form.field('contactPhone')} />
            <TextField label="Email liên hệ" type="email" {...form.field('contactEmail')} />
            <TextField label="Mã số thuế" inputMode="numeric" {...form.field('taxCode')} />
            <TextField label="Địa chỉ" className="span-full" {...form.field('address')} />
            <TextAreaField label="Ghi chú" className="span-full" rows={2} maxLength={2000} {...form.field('note')} />
          </FormGrid>
        </FormSection>
        <FormSection title="Tài khoản chủ trọ" description="SĐT hoặc email là tên đăng nhập — cần ít nhất một, duy nhất toàn hệ thống.">
          <FormGrid>
            <TextField label="Họ tên chủ trọ" required className="span-full" maxLength={200} {...form.field('owner.fullName')} />
            <TextField label="Số điện thoại" inputMode="tel" autoComplete="off" {...form.field('owner.phone')} />
            <TextField label="Email" type="email" autoComplete="off" {...form.field('owner.email')} />
          </FormGrid>
        </FormSection>
      </form>
    </Modal>
  )
}
