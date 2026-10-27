import { useQuery } from '@tanstack/react-query'
import { contractsApi, queryKeys } from '@/api'
import { Alert, CheckboxField, DateField, FormDialog, RadioGroup, SelectField, TextField } from '@/components/ui'
import { OCCUPANT_ROLE_LABELS, RELATIONSHIP_GROUPS, toOptions } from '@/constants/enums'
import { RenterPicker } from '@/features/renters/components/RenterPicker'
import { formatDate, todayVN } from '@/lib/format'
import { isCurrentOccupant } from '../contractRules'

const RELATIONSHIP_OPTIONS = RELATIONSHIP_GROUPS.map((g) => ({ label: g.label, options: Object.entries(g.options).map(([value, label]) => ({ value, label })) }))

/**
 * Đổi người đứng tên trên cùng hợp đồng (contracts.md — CT-UC-25). Số hợp đồng, nợ, cọc, khoản phát sinh giữ nguyên;
 * hợp đồng về "Thiếu tài liệu" (cần bản ký mới) và quan hệ của người ở bị xóa để khai lại theo người làm mốc mới.
 */
export function ChangeRepresentativeDialog({ contract: c, onClose, onDone }) {
  const current = c.occupants.filter(isCurrentOccupant)
  const since = c.representativeSince ?? c.startDate
  return (
    <FormDialog
      title="Đổi người đứng tên"
      description={`Người đứng tên hiện tại: ${c.representativeName} (từ ${formatDate(since)}).`}
      size="md"
      initial={{ renter: null, date: todayVN(), householdHeadRenterId: '', oldRepresentativeMovesOut: false }}
      validate={(v) => ({
        renter: !v.renter ? 'Chọn người đứng tên mới.' : v.renter.id === c.representativeRenterId ? 'Người này đang đứng tên.' : null,
        date: !v.date ? 'Chọn ngày.' : v.date > todayVN() ? 'Ngày đổi không ở tương lai.' : v.date < since ? `Không trước ${formatDate(since)}.` : null,
      })}
      codeFields={{
        REPRESENTATIVE_INVALID_DATE: 'date',
        REPRESENTATIVE_UNCHANGED: 'renter',
        REPRESENTATIVE_ID_REQUIRED: 'renter',
        REPRESENTATIVE_IS_RESIDENT_ELSEWHERE: 'renter',
        RENTER_NOT_FOUND: 'renter',
        HOUSEHOLD_HEAD_NOT_OCCUPANT: 'householdHeadRenterId',
      }}
      submitLabel="Đổi người đứng tên"
      onClose={onClose}
      onSubmit={async (v) => {
        await contractsApi.changeRepresentative(c.id, {
          renterId: v.renter.id,
          date: v.date,
          householdHeadRenterId: v.householdHeadRenterId || null,
          oldRepresentativeMovesOut: v.oldRepresentativeMovesOut,
        })
        await onDone('Đã đổi người đứng tên — cần bổ sung bản hợp đồng ký mới và khai lại quan hệ người ở.')
      }}
    >
      {(form) => (
        <>
          <Alert tone="info">Người mới phải có số giấy tờ; không bắt buộc đang ở (VD bố mẹ ký cho con). Nợ và cọc giữ nguyên trên hợp đồng.</Alert>
          <RenterPicker label="Người đứng tên mới" required value={form.values.renter} excludeIds={[c.representativeRenterId]} onChange={(r) => form.setValue('renter', r)} error={form.errors.renter} />
          <DateField label="Đứng tên từ ngày" required {...form.field('date')} />
          <SelectField
            label="Chủ hộ (khai quan hệ theo người này)"
            placeholder="Người đứng tên mới"
            hint="Chọn một người đang ở nếu người đứng tên không ở cùng"
            options={current.map((o) => ({ value: o.renterId, label: o.fullName }))}
            {...form.field('householdHeadRenterId')}
          />
          <CheckboxField
            label={`${c.representativeName} chuyển đi từ ngày này`}
            description="Ghi người đứng tên cũ chuyển đi và kết thúc xe đang gửi của họ."
            {...form.field('oldRepresentativeMovesOut', { type: 'checkbox' })}
          />
        </>
      )}
    </FormDialog>
  )
}

/**
 * Chuyển một người sang phòng khác đang có hợp đồng hiệu lực (CT-UC-26): ghi chuyển đi ở hợp đồng này, vào hợp đồng đích cùng ngày,
 * xe đang đăng ký của người đó chuyển theo. Phòng đích còn trống thì tạo hợp đồng mới như bình thường; cả phòng chuyển thì dùng "Chuyển phòng".
 */
export function MoveOccupantDialog({ contract: c, occupant, onClose, onDone }) {
  const targets = useQuery({
    queryKey: queryKeys.contracts.list({ status: 'Active', pageSize: 100, moveTargets: true }),
    queryFn: ({ signal }) => contractsApi.list({ status: 'Active', page: 1, pageSize: 100 }, { signal }),
  })
  const options = (targets.data?.items ?? []).filter((t) => t.id !== c.id).map((t) => ({ value: t.id, label: `${t.propertyCode}-${t.roomCode} · ${t.contractNo} — ${t.representativeName}` }))
  return (
    <FormDialog
      title={`Chuyển ${occupant.fullName} sang phòng khác`}
      size="md"
      initial={{ toContractId: '', date: todayVN(), role: 'Resident', relationshipType: '', relationship: '', guardianConsent: false, note: '' }}
      validate={(v) => ({
        toContractId: !v.toContractId ? 'Chọn hợp đồng / phòng đích.' : null,
        date: !v.date ? 'Chọn ngày.' : v.date < occupant.moveInDate ? 'Không trước ngày vào ở.' : null,
      })}
      codeFields={{
        MOVE_SAME_CONTRACT: 'toContractId',
        CONTRACT_NOT_ACTIVE: 'toContractId',
        CONTRACT_NOT_FOUND: 'toContractId',
        OCCUPANCY_OVERLAP: 'toContractId',
        OCCUPANT_LIVES_ELSEWHERE: 'toContractId',
        REPRESENTATIVE_IS_RESIDENT_ELSEWHERE: 'role',
        CO_TENANT_ID_REQUIRED: 'role',
        DATE_OUTSIDE_CONTRACT: 'date',
      }}
      submitLabel="Chuyển người"
      onClose={onClose}
      onSubmit={async (v) => {
        await contractsApi.moveOccupant(c.id, occupant.id, {
          toContractId: v.toContractId,
          date: v.date,
          role: v.role,
          relationshipType: v.relationshipType || null,
          relationship: v.relationship.trim() || null,
          guardianConsent: v.guardianConsent || null,
          note: v.note.trim() || null,
        })
        await onDone(`Đã chuyển ${occupant.fullName} sang hợp đồng khác.`)
      }}
    >
      {(form) => (
        <>
          <SelectField
            label="Chuyển tới phòng (hợp đồng đang hiệu lực)"
            required
            placeholder={targets.isPending ? 'Đang tải…' : options.length ? 'Chọn…' : 'Không có hợp đồng đang hiệu lực nào khác'}
            options={options}
            {...form.field('toContractId')}
          />
          <DateField label="Ngày chuyển" required {...form.field('date')} />
          <RadioGroup label="Vai trò ở hợp đồng mới" options={toOptions(OCCUPANT_ROLE_LABELS)} value={form.values.role} onChange={(role) => form.setValue('role', role)} error={form.errors.role} />
          <SelectField label="Quan hệ với chủ hộ ở hợp đồng mới" placeholder="Chọn…" options={RELATIONSHIP_OPTIONS} {...form.field('relationshipType')} />
          <TextField label={form.values.relationshipType === 'Other' ? 'Ghi rõ quan hệ' : 'Ghi chú quan hệ'} maxLength={50} {...form.field('relationship')} />
          <CheckboxField label="Đã có ý kiến đồng ý của cha, mẹ hoặc người giám hộ" description="Chỉ cần với người chưa đủ 18 tuổi." {...form.field('guardianConsent', { type: 'checkbox' })} />
          <TextField label="Ghi chú" {...form.field('note')} />
        </>
      )}
    </FormDialog>
  )
}
