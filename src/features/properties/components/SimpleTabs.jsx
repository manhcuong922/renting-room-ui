import { useState } from 'react'
import { propertiesApi, queryKeys } from '@/api'
import { Alert, Button, ConfirmDialog, FormGrid, TextAreaField, TextField, useToast } from '@/components/ui'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { PropertyFormFields } from './PropertyFormFields'
import { toPropertyBody, toPropertyForm, validateProperty } from '../propertyForm'

function SaveBar({ children }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>{children}</div>
}

/** Tab Thông tin & cài đặt thu — PUT /properties/{id} (kèm version chống ghi đè). */
export function PropertyInfoTab({ property }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const form = useForm(toPropertyForm(property), { validate: (v) => validateProperty(v, { creating: false }) })

  const submit = form.handleSubmit(async (v) => {
    await propertiesApi.update(property.id, { ...toPropertyBody(v), version: property.version })
    await invalidate(queryKeys.properties.detail(property.id), queryKeys.properties.all)
    toast.success('Đã lưu thông tin khu.')
  })

  return (
    <form onSubmit={submit} noValidate>
      <PropertyFormFields form={form} creating={false} />
      <SaveBar>
        <Button type="submit" loading={form.submitting} disabled={property.isArchived}>
          Lưu thay đổi
        </Button>
      </SaveBar>
    </form>
  )
}

/** Tab Ngân hàng — đủ 3 trường hoặc xóa cả 3. */
export function BankTab({ property }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const [confirmClear, setConfirmClear] = useState(false)
  const bank = property.bankAccount
  const form = useForm(
    { bankName: bank?.bankName ?? '', accountNo: bank?.accountNo ?? '', accountName: bank?.accountName ?? '' },
    {
      validate: (v) => ({
        bankName: !v.bankName.trim() ? 'Nhập tên ngân hàng.' : null,
        accountNo: !/^\d{6,20}$/.test(v.accountNo.trim()) ? 'Số tài khoản 6–20 chữ số.' : null,
        accountName: !v.accountName.trim() ? 'Nhập tên chủ tài khoản.' : null,
      }),
    },
  )

  const save = async (body) => {
    await propertiesApi.updateBankAccount(property.id, body)
    await invalidate(queryKeys.properties.detail(property.id))
  }

  const submit = form.handleSubmit(async (v) => {
    await save({ bankName: v.bankName.trim(), accountNo: v.accountNo.trim(), accountName: v.accountName.trim().toUpperCase() })
    toast.success('Đã lưu tài khoản ngân hàng.')
  })

  return (
    <form onSubmit={submit} noValidate>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>Tài khoản nhận tiền thuê — in vào hợp đồng lúc kích hoạt.</p>
      {form.formError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert>{form.formError}</Alert>
        </div>
      )}
      <FormGrid cols={3}>
        <TextField label="Ngân hàng" required placeholder="VD Vietcombank" {...form.field('bankName')} />
        <TextField label="Số tài khoản" required inputMode="numeric" {...form.field('accountNo')} />
        <TextField label="Chủ tài khoản" required placeholder="NGUYEN VAN A" {...form.field('accountName')} />
      </FormGrid>
      <SaveBar>
        {bank && (
          <Button variant="ghost" onClick={() => setConfirmClear(true)}>
            Xóa tài khoản
          </Button>
        )}
        <Button type="submit" loading={form.submitting}>
          Lưu tài khoản
        </Button>
      </SaveBar>
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Xóa tài khoản ngân hàng?"
        message="Hợp đồng đã kích hoạt vẫn giữ thông tin cũ."
        confirmLabel="Xóa"
        tone="danger"
        onConfirm={async () => {
          await save({ bankName: null, accountNo: null, accountName: null })
          form.reset({ bankName: '', accountNo: '', accountName: '' })
          toast.success('Đã xóa tài khoản ngân hàng.')
        }}
      />
    </form>
  )
}

const MAX_RULES = 20_000

/** Tab Nội quy — chụp vào hợp đồng lúc kích hoạt; sửa sau không ảnh hưởng hợp đồng đã ký. */
export function HouseRulesTab({ property }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const form = useForm({ text: property.houseRulesText ?? '' })

  const submit = form.handleSubmit(async (v) => {
    await propertiesApi.updateHouseRules(property.id, { text: v.text.trim() || null })
    await invalidate(queryKeys.properties.detail(property.id))
    toast.success('Đã lưu nội quy.')
  })

  return (
    <form onSubmit={submit} noValidate>
      {form.formError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert>{form.formError}</Alert>
        </div>
      )}
      <TextAreaField
        label="Nội quy khu trọ"
        rows={14}
        maxLength={MAX_RULES}
        hint={`Được chụp vào hợp đồng lúc kích hoạt. ${form.values.text.length.toLocaleString('vi-VN')}/${MAX_RULES.toLocaleString('vi-VN')} ký tự.`}
        placeholder={'1. Giữ trật tự sau 22h.\n2. Không tự ý sửa chữa, cải tạo phòng.'}
        {...form.field('text')}
      />
      <SaveBar>
        <Button type="submit" loading={form.submitting}>
          Lưu nội quy
        </Button>
      </SaveBar>
    </form>
  )
}
