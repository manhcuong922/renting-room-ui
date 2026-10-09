import { useState } from 'react'
import { Link } from 'react-router'
import { queryKeys, rentersApi } from '@/api'
import { Alert, Button, DateField, FormGrid, FormSection, Modal, SelectField, TextAreaField, TextField } from '@/components/ui'
import { GENDER_LABELS, ID_DOCUMENT_TYPE_LABELS, ID_NUMBER_HINTS, toOptions } from '@/constants/enums'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { formatDate } from '@/lib/format'
import { ID_REQUIRED_FROM_AGE, NO_ID_DOCUMENT, makeRenterValidate, toRenterBody, toRenterForm } from '../renterForm'

const ID_TYPE_OPTIONS = [
  ...toOptions(ID_DOCUMENT_TYPE_LABELS),
  { value: NO_ID_DOCUMENT, label: `Chưa có giấy tờ (dưới ${ID_REQUIRED_FROM_AGE} tuổi)` },
]

/**
 * Tạo (renter = null) hoặc sửa hồ sơ người thuê. Cũng dùng làm "Thêm nhanh" trong wizard hợp đồng.
 * Tạo trùng số giấy tờ (409 RENTER_ID_NUMBER_EXISTS, body có existingRenterId) → mở hồ sơ cũ và đề xuất dùng hồ sơ đó (onUseExisting).
 * onSaved(renterFull) nhận hồ sơ đầy đủ sau khi lưu.
 */
export function RenterFormDialog({ renter, onClose, onSaved, onUseExisting }) {
  const editing = Boolean(renter)
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const [existing, setExisting] = useState(null)
  const form = useForm(toRenterForm(renter), {
    validate: makeRenterValidate(renter),
    serverPrefix: editing ? 'renter' : undefined,
    codeFields: { ID_NUMBER_REQUIRED: 'idNumber', RENTER_ID_NUMBER_EXISTS: 'idNumber', RENTER_ANONYMIZED: 'fullName' },
  })

  const submit = form.handleSubmit(async (v) => {
    setExisting(null)
    const body = toRenterBody(v)
    try {
      let id = renter?.id
      if (editing) await rentersApi.update(renter.id, { renter: body, version: renter.version })
      else ({ id } = await rentersApi.create(body, { idempotencyKey: idem.keyFor(body) }))
      await invalidate(queryKeys.renters.all)
      const saved = await rentersApi.get(id)
      idem.reset()
      onSaved?.(saved)
      onClose()
    } catch (error) {
      const existingId = error.code === 'RENTER_ID_NUMBER_EXISTS' ? error.extensions?.existingRenterId : null
      if (existingId) setExisting(await rentersApi.get(existingId).catch(() => null))
      throw error
    }
  })

  const idType = form.values.idType
  const keepsOldNumber = editing && Boolean(renter.idNumberMasked) && renter.idType === idType

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Sửa hồ sơ — ${renter.fullName}` : 'Thêm người thuê'}
      description={editing ? 'Sửa hồ sơ không đổi thông tin đã in trên hợp đồng đã kích hoạt.' : 'Mỗi số giấy tờ chỉ có một hồ sơ trong tổ chức.'}
      size="lg"
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form="renter-form" loading={form.submitting}>
            {editing ? 'Lưu' : 'Thêm người thuê'}
          </Button>
        </>
      }
    >
      <form id="renter-form" onSubmit={submit} noValidate>
        {(form.formError || existing) && (
          <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            {existing ? (
              <Alert tone="warning">
                Số giấy tờ đã có hồ sơ: <strong>{existing.fullName}</strong> (sinh {formatDate(existing.dateOfBirth)}). Một người được đứng tên
                nhiều phòng, nhưng là người ở thì chỉ ở 1 phòng.{' '}
                {onUseExisting ? (
                  <Button size="sm" variant="secondary" onClick={() => onUseExisting(existing)}>
                    Dùng hồ sơ này
                  </Button>
                ) : (
                  <Link to={`/renters/${existing.id}`}>Xem hồ sơ</Link>
                )}
              </Alert>
            ) : (
              <Alert>{form.formError}</Alert>
            )}
          </div>
        )}

        <FormSection title="Thông tin cá nhân">
          <FormGrid>
            <TextField label="Họ tên" required maxLength={200} className="span-full" autoComplete="off" {...form.field('fullName')} />
            <DateField label="Ngày sinh" required {...form.field('dateOfBirth')} />
            <SelectField label="Giới tính" required placeholder="Chọn…" options={toOptions(GENDER_LABELS)} {...form.field('gender')} />
            <TextField label="Số điện thoại" inputMode="tel" hint="Bắt buộc với người đứng tên hợp đồng" {...form.field('phone')} />
            <TextField label="Email" type="email" {...form.field('email')} />
          </FormGrid>
        </FormSection>

        <FormSection
          title="Giấy tờ tùy thân"
          description={`Từ ${ID_REQUIRED_FROM_AGE} tuổi bắt buộc. Trẻ dưới ${ID_REQUIRED_FROM_AGE} tuổi: chọn "Chưa có giấy tờ", hoặc CCCD + số định danh cá nhân 12 số nếu có. Người chưa có giấy tờ không đứng tên hợp đồng được.`}
        >
          <FormGrid>
            <SelectField label="Loại giấy tờ" options={ID_TYPE_OPTIONS} {...form.field('idType')} />
            {idType !== NO_ID_DOCUMENT && (
              <>
                <TextField
                  label={ID_NUMBER_HINTS[idType]}
                  required={!keepsOldNumber}
                  autoComplete="off"
                  placeholder={keepsOldNumber ? `${renter.idNumberMasked} (để trống = giữ nguyên)` : undefined}
                  {...form.field('idNumber')}
                />
                <DateField label="Ngày cấp" {...form.field('idIssueDate')} />
                <TextField label="Nơi cấp" maxLength={200} {...form.field('idIssuePlace')} />
              </>
            )}
            <TextField
              label="Quốc tịch"
              maxLength={2}
              hint={idType === 'Passport' ? 'Hộ chiếu → thường là người nước ngoài (KR, CN…)' : 'Mã ISO 2 chữ, mặc định VN'}
              {...form.field('nationality')}
            />
            <TextField label="Nơi thường trú" maxLength={500} hint="In vào hợp đồng" {...form.field('permanentAddress')} />
          </FormGrid>
        </FormSection>

        <FormSection title="Công việc & liên hệ khẩn cấp">
          <FormGrid>
            <TextField label="Nghề nghiệp" maxLength={200} {...form.field('occupation')} />
            <TextField label="Nơi làm việc / học tập" maxLength={200} {...form.field('workplace')} />
            <TextField label="Người liên hệ khẩn cấp" maxLength={200} placeholder="VD Trần Văn Nam (bố)" {...form.field('emergencyContactName')} />
            <TextField label="SĐT khẩn cấp" inputMode="tel" maxLength={20} {...form.field('emergencyContactPhone')} />
            <TextAreaField label="Ghi chú" rows={2} maxLength={2000} className="span-full" {...form.field('note')} />
          </FormGrid>
        </FormSection>
      </form>
    </Modal>
  )
}
