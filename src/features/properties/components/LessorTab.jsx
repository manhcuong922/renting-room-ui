import { CircleCheck, TriangleAlert } from 'lucide-react'
import { propertiesApi, queryKeys } from '@/api'
import { Alert, Button, DateField, FormGrid, FormSection, RadioGroup, SecretValue, SelectField, TextField, useToast } from '@/components/ui'
import { ID_DOCUMENT_TYPE_LABELS, ID_NUMBER_HINTS, LESSOR_TYPE_LABELS, toOptions } from '@/constants/enums'
import { useInvalidate } from '@/hooks/useAction'
import { blankToNull, useForm } from '@/hooks/useForm'

function toForm(l) {
  return {
    type: l?.type ?? 'Individual',
    name: l?.name ?? '',
    address: l?.address ?? '',
    phone: l?.phone ?? '',
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

export function LessorTab({ property }) {
  const lessor = property.lessor
  const toast = useToast()
  const invalidate = useInvalidate()
  const form = useForm(toForm(lessor), { validate: makeValidate(lessor), codeFields: { ID_NUMBER_REQUIRED: 'idNumber', LESSOR_UNDERAGE: 'dateOfBirth' } })
  const individual = form.values.type === 'Individual'
  const keepsOldNumber = lessor?.idNumberMasked && lessor.idType === form.values.idType

  const submit = form.handleSubmit(async (v) => {
    const body = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, blankToNull(val)]))
    // null = giữ số giấy tờ cũ (server). Tổ chức không gửi nhóm giấy tờ cá nhân.
    if (!individual) Object.assign(body, { idType: null, idNumber: null, idIssueDate: null, idIssuePlace: null, dateOfBirth: null })
    await propertiesApi.updateLessor(property.id, body)
    await invalidate(queryKeys.properties.detail(property.id), queryKeys.properties.all)
    form.setValue('idNumber', '')
    toast.success('Đã lưu bên cho thuê.')
  })

  return (
    <form onSubmit={submit} noValidate>
      <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        {lessor?.isComplete ? (
          <Alert tone="info">
            <CircleCheck size={14} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> Đã khai báo đủ — ký được hợp đồng.
          </Alert>
        ) : (
          <Alert tone="warning">
            <TriangleAlert size={14} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> Chưa khai báo đủ bên cho thuê — chưa kích hoạt được hợp đồng.
          </Alert>
        )}
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>

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
                Số hiện tại:{' '}
                <SecretValue masked={lessor.idNumberMasked} onReveal={() => propertiesApi.revealLessorIdNumber(property.id)} />
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
        <Button type="submit" loading={form.submitting}>
          Lưu bên cho thuê
        </Button>
      </div>
    </form>
  )
}
