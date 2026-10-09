import { useState } from 'react'
import { organizationApi, queryKeys } from '@/api'
import { Alert, Button, CheckboxField, ConfirmDialog, DescriptionList, FormGrid, NumberField, QueryView, useToast } from '@/components/ui'
import { usePermission } from '@/features/auth/AuthContext'
import { Permission } from '@/features/auth/permissions'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { useDataRetention } from '../hooks'

const MIN_MONTHS = 36
const MAX_MONTHS = 120

function RetentionForm({ data }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const [confirmOff, setConfirmOff] = useState(false)
  const form = useForm(
    { retentionMonths: data.retentionMonths, autoAnonymize: data.autoAnonymize },
    {
      validate: (v) => ({
        retentionMonths:
          !Number.isInteger(v.retentionMonths) || v.retentionMonths < MIN_MONTHS || v.retentionMonths > MAX_MONTHS
            ? `Từ ${MIN_MONTHS} đến ${MAX_MONTHS} tháng.`
            : null,
      }),
    },
  )
  const changed = form.values.retentionMonths !== data.retentionMonths || form.values.autoAnonymize !== data.autoAnonymize

  const save = async (v) => {
    await organizationApi.updateDataRetention(v)
    await invalidate(queryKeys.organization.dataRetention)
    toast.success('Đã lưu thời gian giữ dữ liệu.')
  }
  // Tắt ẩn danh tự động → hỏi xác nhận "tự chịu trách nhiệm lưu giữ dữ liệu cá nhân".
  const submit = form.handleSubmit(async (v) => {
    if (data.autoAnonymize && !v.autoAnonymize) {
      setConfirmOff(true)
      return
    }
    await save(v)
  })

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {form.formError && <Alert>{form.formError}</Alert>}
      <FormGrid>
        <NumberField
          label="Giữ dữ liệu người thuê"
          suffix="tháng"
          hint={`${MIN_MONTHS}–${MAX_MONTHS} tháng sau lần cuối gắn với hợp đồng`}
          disabled={!form.values.autoAnonymize}
          {...form.field('retentionMonths', { type: 'value' })}
        />
        <CheckboxField
          label="Tự động ẩn danh"
          description="Mỗi đêm ẩn danh người thuê đã rời đi quá thời gian giữ, không còn hợp đồng đang chạy, không còn nợ / phiếu chờ hoàn."
          {...form.field('autoAnonymize', { type: 'checkbox' })}
        />
      </FormGrid>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" loading={form.submitting} disabled={!changed}>
          Lưu
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title="Tắt ẩn danh tự động?"
        message="Dữ liệu cá nhân người thuê cũ sẽ được giữ vô thời hạn. Bạn tự chịu trách nhiệm lưu giữ dữ liệu cá nhân theo luật bảo vệ dữ liệu cá nhân. Thay đổi được ghi nhật ký."
        confirmLabel="Tắt ẩn danh tự động"
        tone="danger"
        onConfirm={() => save(form.values)}
      />
    </form>
  )
}

/**
 * Thời gian giữ dữ liệu người thuê (members.md#thời-gian-giữ-dữ-liệu-người-thuê). Chủ trọ sửa; phó quản lý chỉ xem.
 * Ẩn danh ngay một hồ sơ: nút "Ẩn danh" ở hồ sơ người thuê.
 */
export function DataRetentionTab() {
  const canManage = usePermission(Permission.OrganizationSettingsManage)
  const query = useDataRetention()
  return (
    <QueryView query={query} loading="page" errorTitle="Không tải được cài đặt giữ dữ liệu">
      {(data) => (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {data.warnings?.map((w) => (
            <Alert key={w.code} tone="warning">
              {w.message}
            </Alert>
          ))}
          {canManage ? (
            <RetentionForm key={`${data.retentionMonths}-${data.autoAnonymize}`} data={data} />
          ) : (
            <DescriptionList
              items={[
                { label: 'Giữ dữ liệu người thuê', value: `${data.retentionMonths} tháng` },
                { label: 'Tự động ẩn danh', value: data.autoAnonymize ? 'Bật' : 'Tắt' },
              ]}
            />
          )}
        </div>
      )}
    </QueryView>
  )
}
