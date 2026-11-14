import { useState } from 'react'
import { propertiesApi, queryKeys } from '@/api'
import { Alert, Button, ConfirmDialog, DescriptionList, FormGrid, TextAreaField, TextField, useToast } from '@/components/ui'
import { usePermission } from '@/features/auth/AuthContext'
import { Permission } from '@/features/auth/permissions'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { PropertyFormFields } from './PropertyFormFields'
import { toPropertyBody, toPropertyForm, validateProperty } from '../propertyForm'

function SaveBar({ children }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>{children}</div>
}

/** Tab Thông tin chung — PUT /properties/{id} (kèm version chống ghi đè; không gồm cài đặt kỳ thu). */
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

const EMPTY_BANK = { bankName: '', accountNo: '', accountName: '' }

const normalizeBank = (v) => ({ bankName: v.bankName.trim(), accountNo: v.accountNo.trim(), accountName: v.accountName.trim().toUpperCase() })

const sameBank = (a, b) => Boolean(b) && a.bankName === b.bankName && a.accountNo === b.accountNo && a.accountName === b.accountName

const BANK_NOTE = 'Tài khoản nhận tiền thuê — in trên phiếu báo và vào hợp đồng lúc kích hoạt. Chỉ chủ trọ được sửa.'

/**
 * Tab Ngân hàng — đủ 3 trường hoặc xóa cả 3 (properties.md#ngân-hàng).
 * Số tài khoản in trên mọi phiếu / mã QR ⇒ chỉ chủ trọ sửa; đổi / xóa phải nhập mật khẩu đăng nhập (H-06). Quản lý khu chỉ xem.
 */
export function BankTab({ property }) {
  const canManage = usePermission(Permission.PropertiesBankManage)
  const bank = property.bankAccount

  if (!canManage) {
    return (
      <>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>{BANK_NOTE}</p>
        <DescriptionList
          columns={3}
          items={[
            { label: 'Ngân hàng', value: bank?.bankName },
            { label: 'Số tài khoản', value: bank?.accountNo },
            { label: 'Chủ tài khoản', value: bank?.accountName },
          ]}
        />
      </>
    )
  }
  return <BankForm property={property} />
}

function BankForm({ property }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearPassword, setClearPassword] = useState('')
  const bank = property.bankAccount
  // Server so sau khi cắt khoảng trắng: gửi lại đúng tài khoản đang lưu thì không cần mật khẩu.
  const changed = (v) => !sameBank(normalizeBank(v), bank)
  const form = useForm(
    { ...EMPTY_BANK, ...(bank && { bankName: bank.bankName, accountNo: bank.accountNo, accountName: bank.accountName }), currentPassword: '' },
    {
      validate: (v) => ({
        bankName: !v.bankName.trim() ? 'Nhập tên ngân hàng.' : null,
        accountNo: !/^\d{6,20}$/.test(v.accountNo.trim()) ? 'Số tài khoản 6–20 chữ số.' : null,
        accountName: !v.accountName.trim() ? 'Nhập tên chủ tài khoản.' : null,
        currentPassword: changed(v) && !v.currentPassword ? 'Nhập mật khẩu đăng nhập để xác nhận đổi tài khoản.' : null,
      }),
      codeFields: { CURRENT_PASSWORD_REQUIRED: 'currentPassword', INVALID_CURRENT_PASSWORD: 'currentPassword' },
    },
  )
  const needsPassword = changed(form.values)

  const save = async (body) => {
    await propertiesApi.updateBankAccount(property.id, body)
    await invalidate(queryKeys.properties.detail(property.id))
  }

  const submit = form.handleSubmit(async (v) => {
    await save({ ...normalizeBank(v), currentPassword: changed(v) ? v.currentPassword : null })
    toast.success('Đã lưu tài khoản ngân hàng.')
  })

  const closeClear = () => {
    setConfirmClear(false)
    setClearPassword('')
  }

  return (
    <form onSubmit={submit} noValidate>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>{BANK_NOTE}</p>
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
      {needsPassword && (
        <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-4)', maxWidth: '28rem' }}>
          {bank && (
            <Alert tone="warning">Người thuê sẽ chuyển tiền vào tài khoản mới từ phiếu báo tiếp theo — kiểm tra kỹ số tài khoản trước khi lưu.</Alert>
          )}
          <TextField
            label="Mật khẩu đăng nhập"
            type="password"
            required
            autoComplete="current-password"
            hint="Xác nhận chính bạn đổi tài khoản nhận tiền. Nhập sai nhiều lần tài khoản sẽ bị khóa tạm 15 phút."
            {...form.field('currentPassword')}
          />
        </div>
      )}
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
        onClose={closeClear}
        title="Xóa tài khoản ngân hàng?"
        message="Phiếu báo sẽ không còn số tài khoản nhận tiền. Hợp đồng đã kích hoạt vẫn giữ thông tin cũ."
        confirmLabel="Xóa"
        tone="danger"
        onConfirm={async () => {
          await save({ bankName: null, accountNo: null, accountName: null, currentPassword: clearPassword || null })
          form.reset({ ...EMPTY_BANK, currentPassword: '' })
          setClearPassword('')
          toast.success('Đã xóa tài khoản ngân hàng.')
        }}
      >
        <TextField
          label="Mật khẩu đăng nhập"
          type="password"
          required
          autoComplete="current-password"
          value={clearPassword}
          onChange={(e) => setClearPassword(e.target.value)}
        />
      </ConfirmDialog>
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
