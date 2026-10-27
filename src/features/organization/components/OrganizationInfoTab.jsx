import { useQueryClient } from '@tanstack/react-query'
import { organizationApi, queryKeys } from '@/api'
import { Alert, Button, DescriptionList, FormGrid, QueryView, TextField, useToast } from '@/components/ui'
import { useAuth, usePermission } from '@/features/auth/AuthContext'
import { Permission } from '@/features/auth/permissions'
import { cleanStrings, useForm } from '@/hooks/useForm'
import { normalizeEmail, normalizePhone } from '@/lib/contact'
import { useOrganizationInfo } from '../hooks'

const toForm = (o) => ({
  name: o.name ?? '',
  contactName: o.contactName ?? '',
  contactPhone: o.contactPhone ?? '',
  contactEmail: o.contactEmail ?? '',
  taxCode: o.taxCode ?? '',
  address: o.address ?? '',
})

function validate(v) {
  return {
    name: !v.name.trim() ? 'Nhập tên tổ chức.' : null,
    contactPhone: v.contactPhone.trim() && !normalizePhone(v.contactPhone) ? 'Số di động Việt Nam không hợp lệ.' : null,
    contactEmail: v.contactEmail.trim() && !normalizeEmail(v.contactEmail) ? 'Email không hợp lệ.' : null,
  }
}

function InfoForm({ info }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { refreshUser } = useAuth()
  const initial = toForm(info)
  const form = useForm(initial, { validate })
  const changed = Object.keys(initial).some((key) => form.values[key].trim() !== initial[key])

  const submit = form.handleSubmit(async (v) => {
    const saved = await organizationApi.updateInfo({ ...cleanStrings(v), name: v.name.trim() })
    // PUT trả thông tin sau khi sửa → dùng luôn, không gọi lại. Tên tổ chức mới hiện ngay ở GET /me (thanh tiêu đề).
    queryClient.setQueryData(queryKeys.organization.info, saved)
    refreshUser()
    toast.success('Đã lưu thông tin tổ chức.')
  })

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {form.formError && <Alert>{form.formError}</Alert>}
      <FormGrid>
        <TextField label="Mã tổ chức" value={info.code} disabled readOnly hint="Không đổi được" />
        <TextField label="Tên tổ chức" required maxLength={200} {...form.field('name')} />
        <TextField label="Người liên hệ" maxLength={200} {...form.field('contactName')} />
        <TextField label="SĐT liên hệ" inputMode="tel" {...form.field('contactPhone')} />
        <TextField label="Email liên hệ" type="email" {...form.field('contactEmail')} />
        <TextField label="Mã số thuế" maxLength={14} {...form.field('taxCode')} />
        <TextField label="Địa chỉ" maxLength={500} className="span-full" {...form.field('address')} />
      </FormGrid>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" loading={form.submitting} disabled={!changed}>
          Lưu
        </Button>
      </div>
    </form>
  )
}

/**
 * Thông tin tổ chức (members.md#thông-tin-tổ-chức): GET /org mọi thành viên; PUT /org chỉ chủ trọ — phó quản lý chỉ xem.
 * Thông tin liên hệ ở đây được điền sẵn cho form "Thông tin chủ trọ" lần đầu.
 */
export function OrganizationInfoTab() {
  const canManage = usePermission(Permission.OrganizationSettingsManage)
  const query = useOrganizationInfo()
  return (
    <QueryView query={query} loading="page" errorTitle="Không tải được thông tin tổ chức">
      {(info) =>
        canManage ? (
          <InfoForm key={JSON.stringify(info)} info={info} />
        ) : (
          <DescriptionList
            items={[
              { label: 'Mã tổ chức', value: info.code },
              { label: 'Tên tổ chức', value: info.name },
              { label: 'Người liên hệ', value: info.contactName },
              { label: 'SĐT liên hệ', value: info.contactPhone },
              { label: 'Email liên hệ', value: info.contactEmail },
              { label: 'Mã số thuế', value: info.taxCode },
              { label: 'Địa chỉ', value: info.address, full: true },
            ]}
          />
        )
      }
    </QueryView>
  )
}
