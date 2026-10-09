import { Alert, Button, DateField, DescriptionList, FormGrid, FormSection, RadioGroup, SecretValue, SelectField, TextField } from '@/components/ui'
import { ID_DOCUMENT_TYPE_LABELS, ID_NUMBER_HINTS, LESSOR_TYPE_LABELS, toOptions } from '@/constants/enums'
import { blankToNull, useForm } from '@/hooks/useForm'
import { formatDate } from '@/lib/format'

function toForm(l, prefill) {
  return {
    type: l?.type ?? 'Individual',
    name: l?.name ?? prefill?.name ?? '',
    address: l?.address ?? prefill?.address ?? '',
    phone: l?.phone ?? prefill?.phone ?? '',
    email: l?.email ?? '',
    idType: l?.idType ?? 'CitizenId',
    idNumber: '',
    idIssueDate: l?.idIssueDate ?? '',
    idIssuePlace: l?.idIssuePlace ?? '',
    dateOfBirth: l?.dateOfBirth ?? '',
    taxCode: l?.taxCode ?? '',
    representativeName: l?.representativeName ?? '',
    representativeTitle: l?.representativeTitle ?? '',
    authorizationDocNo: l?.authorizationDocNo ?? '',
    authorizationDocDate: l?.authorizationDocDate ?? '',
  }
}

// docs/api/properties.md#bên-cho-thuê
function makeValidate(existing) {
  return (v) => {
    const individual = v.type === 'Individual'
    const needsIdNumber = individual && (!existing?.idNumberMasked || existing.idType !== v.idType)
    return {
      name: !v.name.trim() ? 'Nhập tên bên cho thuê.' : null,
      address: !v.address.trim() ? 'Nhập địa chỉ.' : null,
      phone: !v.phone.trim() ? 'Nhập số điện thoại.' : null,
      idNumber: needsIdNumber && !v.idNumber.trim() ? 'Nhập số giấy tờ.' : null,
      dateOfBirth: individual && !v.dateOfBirth ? 'Nhập ngày sinh (phải đủ 18 tuổi).' : null,
      taxCode: !individual && !/^\d{10}(-\d{3})?$/.test(v.taxCode.trim()) ? 'Mã số thuế: 10 số hoặc 10 số-3 số.' : null,
      representativeName: !individual && !v.representativeName.trim() ? 'Nhập người đại diện.' : null,
      representativeTitle: !individual && !v.representativeTitle.trim() ? 'Nhập chức vụ.' : null,
      authorizationDocDate: v.authorizationDocNo.trim() && !v.authorizationDocDate ? 'Có số giấy ủy quyền thì phải có ngày.' : null,
    }
  }
}

/** Body PUT bên cho thuê: chuỗi rỗng → null; idNumber null = giữ số cũ; tổ chức không gửi nhóm giấy tờ cá nhân. */
function toBody(v) {
  const body = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, blankToNull(val)]))
  if (v.type !== 'Individual') Object.assign(body, { idType: null, idNumber: null, idIssueDate: null, idIssuePlace: null, dateOfBirth: null })
  return body
}

/**
 * Form bên cho thuê — dùng cho Thông tin chủ trọ (PUT /org/lessor) và bên cho thuê riêng của khu (PUT /properties/{id}/lessor).
 * `prefill` (chỉ lần đầu): gợi ý tên / SĐT / địa chỉ từ thông tin liên hệ của tổ chức.
 * `onReveal` không truyền (không có quyền dữ liệu nhạy cảm) → chỉ hiện số đã che.
 */
export function LessorForm({ lessor, prefill, onSave, onReveal, submitLabel = 'Lưu bên cho thuê', extraActions }) {
  const form = useForm(toForm(lessor, prefill), {
    validate: makeValidate(lessor),
    codeFields: { ID_NUMBER_REQUIRED: 'idNumber', LESSOR_UNDERAGE: 'dateOfBirth' },
  })
  const individual = form.values.type === 'Individual'
  const keepsOldNumber = lessor?.idNumberMasked && lessor.idType === form.values.idType

  const submit = form.handleSubmit(async (v) => {
    await onSave(toBody(v))
    form.setValue('idNumber', '')
  })

  return (
    <form onSubmit={submit} noValidate>
      {form.formError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert>{form.formError}</Alert>
        </div>
      )}

      <FormSection title="Bên cho thuê" description="Người/tổ chức đứng tên bên A trên hợp đồng.">
        <FormGrid>
          <RadioGroup
            label="Loại"
            className="span-full"
            options={toOptions(LESSOR_TYPE_LABELS)}
            value={form.values.type}
            onChange={(v) => form.setValue('type', v)}
          />
          <TextField label={individual ? 'Họ tên' : 'Tên tổ chức'} required maxLength={200} {...form.field('name')} />
          <TextField label="Số điện thoại" required inputMode="tel" {...form.field('phone')} />
          <TextField label="Địa chỉ" required className="span-full" {...form.field('address')} />
          <TextField label="Email" type="email" {...form.field('email')} />
          {!individual && <TextField label="Mã số thuế" required inputMode="numeric" {...form.field('taxCode')} />}
        </FormGrid>
      </FormSection>

      {individual ? (
        <FormSection title="Giấy tờ tùy thân">
          <FormGrid>
            <SelectField label="Loại giấy tờ" options={toOptions(ID_DOCUMENT_TYPE_LABELS)} {...form.field('idType')} />
            <TextField
              label={ID_NUMBER_HINTS[form.values.idType]}
              required={!keepsOldNumber}
              placeholder={keepsOldNumber ? `${lessor.idNumberMasked} (để trống = giữ nguyên)` : undefined}
              autoComplete="off"
              {...form.field('idNumber')}
            />
            {lessor?.idNumberMasked && (
              <div className="span-full" style={{ fontSize: 'var(--text-sm)' }}>
                Số hiện tại: <SecretValue masked={lessor.idNumberMasked} onReveal={onReveal} />
              </div>
            )}
            <DateField label="Ngày cấp" {...form.field('idIssueDate')} />
            <TextField label="Nơi cấp" {...form.field('idIssuePlace')} />
            <DateField label="Ngày sinh" required {...form.field('dateOfBirth')} />
          </FormGrid>
        </FormSection>
      ) : (
        <FormSection title="Người đại diện">
          <FormGrid>
            <TextField label="Họ tên người đại diện" required {...form.field('representativeName')} />
            <TextField label="Chức vụ" required {...form.field('representativeTitle')} />
          </FormGrid>
        </FormSection>
      )}

      <FormSection title="Giấy ủy quyền" description="Nếu người ký là người được ủy quyền.">
        <FormGrid>
          <TextField label="Số giấy ủy quyền" {...form.field('authorizationDocNo')} />
          <DateField label="Ngày ủy quyền" {...form.field('authorizationDocDate')} />
        </FormGrid>
      </FormSection>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>
        {extraActions}
        <Button type="submit" loading={form.submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** Xem bên cho thuê (chỉ đọc) — khu đang dùng thông tin chủ trọ, hoặc phó quản lý xem thông tin chủ trọ. */
export function LessorSummary({ lessor, onReveal }) {
  const individual = lessor.type === 'Individual'
  return (
    <DescriptionList
      items={[
        { label: 'Loại', value: LESSOR_TYPE_LABELS[lessor.type] },
        { label: individual ? 'Họ tên' : 'Tên tổ chức', value: lessor.name },
        { label: 'Số điện thoại', value: lessor.phone },
        { label: 'Email', value: lessor.email },
        { label: 'Địa chỉ', value: lessor.address, full: true },
        {
          label: 'Giấy tờ',
          hidden: !individual,
          value: lessor.idNumberMasked && (
            <>
              {ID_DOCUMENT_TYPE_LABELS[lessor.idType]} <SecretValue masked={lessor.idNumberMasked} onReveal={onReveal} />
            </>
          ),
        },
        { label: 'Ngày sinh', hidden: !individual, value: formatDate(lessor.dateOfBirth) },
        { label: 'Mã số thuế', hidden: individual, value: lessor.taxCode },
        { label: 'Người đại diện', hidden: individual, value: [lessor.representativeName, lessor.representativeTitle].filter(Boolean).join(' — ') },
        { label: 'Giấy ủy quyền', hidden: !lessor.authorizationDocNo, value: `${lessor.authorizationDocNo} (${formatDate(lessor.authorizationDocDate)})` },
      ]}
    />
  )
}
