import { useNavigate } from 'react-router'
import { Alert, Button, FormGrid, Modal, TextField, useToast } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { blankToNull, useForm } from '@/hooks/useForm'
import { normalizeEmail, normalizePhone } from '@/lib/contact'

const FORM_ID = 'profile-form'

/**
 * Tự sửa hồ sơ — PUT /me (auth.md#tự-sửa-hồ-sơ-của-mình). Chỉ chủ trọ và SystemAdmin.
 * Đổi SĐT / email (tên đăng nhập) phải nhập mật khẩu hiện tại; lưu xong mọi phiên bị vô hiệu → về màn đăng nhập.
 */
export function ProfileEditDialog({ onClose }) {
  const { user, updateProfile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  // Server so sánh sau khi chuẩn hóa: "0912 345 678" với "0912345678" là không đổi.
  const loginChanged = (v) => normalizePhone(v.phone) !== (user.phone ?? null) || normalizeEmail(v.email) !== (user.email ?? null)

  const form = useForm(
    { fullName: user.fullName ?? '', phone: user.phone ?? '', email: user.email ?? '', currentPassword: '' },
    {
      validate: (v) => ({
        fullName: !v.fullName.trim() ? 'Nhập họ tên.' : null,
        phone:
          !v.phone.trim() && !v.email.trim() ? 'Cần SĐT hoặc email để đăng nhập.'
          : v.phone.trim() && !normalizePhone(v.phone) ? 'Số di động Việt Nam không hợp lệ.'
          : null,
        email: v.email.trim() && !normalizeEmail(v.email) ? 'Email không hợp lệ.' : null,
        currentPassword: loginChanged(v) && !v.currentPassword ? 'Nhập mật khẩu hiện tại để đổi tên đăng nhập.' : null,
      }),
      codeFields: {
        PHONE_TAKEN: 'phone',
        EMAIL_TAKEN: 'email',
        USERNAME_REQUIRED: 'phone',
        CURRENT_PASSWORD_REQUIRED: 'currentPassword',
        INVALID_CURRENT_PASSWORD: 'currentPassword',
      },
    },
  )
  const changesLogin = loginChanged(form.values)

  const submit = form.handleSubmit(async (v) => {
    const { reauthenticate } = await updateProfile({
      fullName: v.fullName.trim(),
      phone: blankToNull(v.phone),
      email: blankToNull(v.email),
      currentPassword: loginChanged(v) ? v.currentPassword : null,
    })
    if (reauthenticate) {
      toast.success('Đã đổi tên đăng nhập. Vui lòng đăng nhập lại bằng SĐT / email mới, mật khẩu giữ nguyên.', { duration: 8000 })
      navigate('/login', { replace: true })
      return
    }
    toast.success('Đã cập nhật hồ sơ.')
    onClose()
  })

  return (
    <Modal
      open
      onClose={onClose}
      title="Sửa hồ sơ"
      description="SĐT và email là tên đăng nhập."
      size="sm"
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} loading={form.submitting}>
            Lưu
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <FormGrid cols={1}>
          {form.formError && <Alert>{form.formError}</Alert>}
          <TextField label="Họ tên" required maxLength={200} autoComplete="name" {...form.field('fullName')} />
          <TextField label="Số điện thoại" inputMode="tel" autoComplete="off" {...form.field('phone')} />
          <TextField label="Email" type="email" autoComplete="off" {...form.field('email')} />
          {changesLogin && (
            <>
              <Alert tone="warning">
                Bạn đang đổi tên đăng nhập. Sau khi lưu, mọi thiết bị bị đăng xuất và bạn phải đăng nhập lại bằng SĐT / email mới.
              </Alert>
              <TextField
                label="Mật khẩu hiện tại"
                type="password"
                required
                autoComplete="current-password"
                hint="Nhập sai nhiều lần tài khoản sẽ bị khóa tạm 15 phút."
                {...form.field('currentPassword')}
              />
            </>
          )}
        </FormGrid>
      </form>
    </Modal>
  )
}
