import { Crown, Trash, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Alert, Badge, Button, CheckboxField, DateField, FormGrid, FormSection, SelectField, TextField } from '@/components/ui'
import { GENDER_LABELS, RELATIONSHIP_GROUPS } from '@/constants/enums'
import { RenterPicker } from '@/features/renters/components/RenterPicker'
import { ageAt } from '@/features/renters/renterForm'
import { formatDate } from '@/lib/format'
import { emptyOccupant, needsGuardianConsent, relationshipAllowed } from '../contractForm'
import styles from './Wizard.module.css'

function relationshipOptions(gender) {
  return RELATIONSHIP_GROUPS.map((g) => ({
    label: g.label,
    options: Object.entries(g.options)
      .filter(([value]) => relationshipAllowed(value, gender))
      .map(([value, label]) => ({ value, label })),
  })).filter((g) => g.options.length)
}

/**
 * Bước 2 — người đại diện ký + người ở (docs/api/contracts.md#người-ở).
 * Người đại diện KHÔNG tự động là người ở → mặc định tích "cũng ở phòng này".
 * Mỗi người ở (trừ chủ hộ) khai quan hệ với chủ hộ; chủ hộ mặc định là người đứng tên.
 */
export function PeopleStep({ form, room }) {
  const v = form.values
  const [adding, setAdding] = useState(false)
  const rep = v.representative
  const headId = v.householdHeadRenterId || rep?.id
  const usedIds = [rep?.id, ...v.occupants.map((o) => o.renter.id)].filter(Boolean)
  const occupantCount = v.occupants.length + (v.representativeIsOccupant && rep ? 1 : 0)
  const repAge = ageAt(rep?.dateOfBirth, v.startDate)

  const setRepresentative = (renter) => {
    form.setValue('representative', renter)
    // Người vừa chọn làm đại diện mà đang nằm trong danh sách người ở → bỏ khỏi danh sách (tránh trùng).
    if (renter) form.setValue('occupants', v.occupants.filter((o) => o.renter.id !== renter.id))
    if (v.householdHeadRenterId === renter?.id) form.setValue('householdHeadRenterId', '')
  }

  const removeOccupant = (index) => {
    const removed = v.occupants[index]
    form.setValue('occupants', v.occupants.filter((_, i) => i !== index))
    if (removed.renter.id === v.householdHeadRenterId) form.setValue('householdHeadRenterId', '')
  }

  return (
    <>
      <FormSection title="Người đại diện ký hợp đồng" description="Phải đủ 18 tuổi tại ngày ký và có số điện thoại.">
        <RenterPicker label="Người đại diện" required value={rep} onChange={setRepresentative} error={form.errors.representative} />
        {rep && (
          <div className={styles.stack}>
            {!rep.phone && <Alert tone="warning">Người đại diện chưa có số điện thoại — cần bổ sung trước khi kích hoạt.</Alert>}
            {repAge !== null && repAge < 18 && <Alert tone="warning">Người đại diện chưa đủ 18 tuổi tại ngày bắt đầu — không kích hoạt được.</Alert>}
            <CheckboxField
              label="Người đại diện cũng ở phòng này"
              description="Bỏ tích nếu người ký không ở (VD bố mẹ ký thuê cho con)."
              {...form.field('representativeIsOccupant', { type: 'checkbox' })}
            />
            {v.representativeIsOccupant && (
              <FormGrid>
                <DateField label="Ngày vào ở" hint="Trống = ngày bắt đầu hợp đồng" {...form.field('representativeMoveInDate')} />
              </FormGrid>
            )}
          </div>
        )}
      </FormSection>

      <FormSection
        title={`Người ở cùng (${occupantCount}${room ? `/${room.maxOccupants}` : ''})`}
        description="Kích hoạt hợp đồng cần ít nhất 1 người ở. Quan hệ khai so với chủ hộ (theo Thông tư 55/2021/TT-BCA)."
      >
        {room && occupantCount > room.maxOccupants && (
          <div className={styles.stack}>
            <Alert tone="warning">Vượt sức chứa phòng ({room.maxOccupants} người). Khi kích hoạt sẽ cần xác nhận vượt sức chứa.</Alert>
          </div>
        )}

        <ul className={styles.occupants}>
          {v.occupants.map((o, i) => {
            const isHead = o.renter.id === headId
            const age = ageAt(o.renter.dateOfBirth, o.moveInDate || v.startDate)
            return (
              <li key={o.renter.id} className={styles.occupant}>
                <div className={styles.occupantHead}>
                  <div>
                    <strong>{o.renter.fullName}</strong>
                    <span className={styles.muted}>
                      {' '}
                      · {GENDER_LABELS[o.renter.gender] ?? ''} · {formatDate(o.renter.dateOfBirth)}
                      {age !== null && ` (${age} tuổi)`}
                    </span>
                    {isHead && (
                      <Badge tone="primary">
                        <Crown size={12} aria-hidden /> Chủ hộ
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" iconOnly icon={Trash} onClick={() => removeOccupant(i)}>
                    Bỏ người ở
                  </Button>
                </div>
                <FormGrid cols={3}>
                  {!isHead && (
                    <SelectField
                      label="Quan hệ với chủ hộ"
                      required
                      placeholder="Chọn…"
                      options={relationshipOptions(o.renter.gender)}
                      {...form.field(`occupants.${i}.relationshipType`)}
                    />
                  )}
                  {!isHead && (
                    <TextField
                      label={o.relationshipType === 'Other' ? 'Ghi rõ quan hệ' : 'Ghi chú quan hệ'}
                      required={o.relationshipType === 'Other'}
                      maxLength={50}
                      placeholder="VD em gái, bạn học"
                      {...form.field(`occupants.${i}.relationship`)}
                    />
                  )}
                  <DateField label="Ngày vào ở" hint="Trống = ngày bắt đầu" {...form.field(`occupants.${i}.moveInDate`)} />
                </FormGrid>
                {needsGuardianConsent(o, v.startDate) && (
                  <CheckboxField
                    className={styles.consent}
                    label="Đã có ý kiến đồng ý của cha, mẹ hoặc người giám hộ"
                    description="Người chưa đủ 18 tuổi mà người đứng tên không phải cha/mẹ/giám hộ (Luật Cư trú 2020, Điều 28)."
                    {...form.field(`occupants.${i}.guardianConsent`, { type: 'checkbox' })}
                  />
                )}
              </li>
            )
          })}
        </ul>

        {adding ? (
          <RenterPicker
            label="Thêm người ở"
            value={null}
            excludeIds={usedIds}
            onChange={(renter) => {
              if (renter) form.setValue('occupants', [...v.occupants, emptyOccupant(renter)])
              setAdding(false)
            }}
          />
        ) : (
          <Button variant="secondary" icon={UserPlus} onClick={() => setAdding(true)} disabled={occupantCount >= 20}>
            Thêm người ở
          </Button>
        )}
      </FormSection>

      {v.occupants.length > 0 && (
        <FormSection title="Chủ hộ" description="Khi đăng ký tạm trú chung. Dùng khi người đứng tên không ở cùng — chọn một người ở làm chủ hộ.">
          <FormGrid>
            <SelectField
              label="Chủ hộ"
              options={[
                { value: '', label: rep ? `${rep.fullName} (người đứng tên)` : 'Người đứng tên' },
                ...v.occupants.map((o) => ({ value: o.renter.id, label: o.renter.fullName })),
              ]}
              {...form.field('householdHeadRenterId')}
            />
          </FormGrid>
        </FormSection>
      )}
    </>
  )
}
