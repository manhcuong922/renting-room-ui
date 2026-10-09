import { Crown, LogOut, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { contractsApi } from '@/api'
import {
  Badge,
  Button,
  CheckboxField,
  DataTable,
  DateField,
  EmptyState,
  FormDialog,
  FormGrid,
  Section,
  SelectField,
  TextField,
  useToast,
} from '@/components/ui'
import { RELATIONSHIP_GROUPS, RELATIONSHIP_LABELS } from '@/constants/enums'
import { RenterPicker } from '@/features/renters/components/RenterPicker'
import { formatDate, todayVN } from '@/lib/format'
import { needsGuardianConsent, relationshipAllowed } from '../contractForm'
import { isCurrentOccupant } from '../contractRules'

function relationshipOptions(gender) {
  return RELATIONSHIP_GROUPS.map((g) => ({
    label: g.label,
    options: Object.entries(g.options)
      .filter(([value]) => relationshipAllowed(value, gender))
      .map(([value, label]) => ({ value, label })),
  })).filter((g) => g.options.length)
}

// docs/api/contracts.md#người-ở — occupantId là occupants[].id (không phải renterId).
export function OccupantsTab({ contract: c, actions, refresh }) {
  const toast = useToast()
  const [dialog, setDialog] = useState(null) // { type: 'add' } | { type: 'end', occupant }
  const headId = c.householdHeadRenterId ?? c.representativeRenterId

  const columns = [
    {
      key: 'name',
      header: 'Họ tên',
      primary: true,
      cell: (o) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <Link to={`/renters/${o.renterId}`}>{o.fullName}</Link>
          {o.isRepresentative && <Badge tone="primary">Đứng tên</Badge>}
          {(o.isHouseholdHead || o.renterId === headId) && (
            <Badge tone="info">
              <Crown size={12} aria-hidden /> Chủ hộ
            </Badge>
          )}
          {!isCurrentOccupant(o) && <Badge>Đã chuyển đi</Badge>}
        </span>
      ),
    },
    {
      key: 'rel',
      header: 'Quan hệ với chủ hộ',
      cell: (o) => [RELATIONSHIP_LABELS[o.relationshipType], o.relationship].filter(Boolean).join(' — ') || '—',
    },
    { key: 'in', header: 'Vào ở', cell: (o) => formatDate(o.moveInDate) },
    { key: 'out', header: 'Chuyển đi', cell: (o) => (o.moveOutDate ? formatDate(o.moveOutDate) : '—') },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (o) =>
        actions.endOccupancy &&
        !o.moveOutDate && (
          <Button size="sm" variant="secondary" icon={LogOut} onClick={() => setDialog({ type: 'end', occupant: o })}>
            Chuyển đi
          </Button>
        ),
    },
  ]

  return (
    <>
      <Section
        title="Người ở"
        description={c.status === 'Draft' ? 'Ở bản nháp, sửa danh sách người ở trong "Sửa nháp" để đổi quan hệ / chủ hộ.' : 'Người ở chuyển đi giữa kỳ: bấm "Chuyển đi".'}
        actions={
          actions.addOccupant && (
            <Button size="sm" icon={UserPlus} onClick={() => setDialog({ type: 'add' })}>
              Thêm người ở
            </Button>
          )
        }
      >
        {c.occupants.length ? <DataTable columns={columns} rows={c.occupants} caption="Người ở" /> : <EmptyState title="Chưa có người ở" description="Kích hoạt cần ít nhất 1 người ở." />}
      </Section>

      {dialog?.type === 'add' && (
        <AddOccupantDialog
          contract={c}
          onClose={() => setDialog(null)}
          onDone={async () => {
            await refresh()
            toast.success('Đã thêm người ở.')
          }}
        />
      )}
      {dialog?.type === 'end' && (
        <FormDialog
          title={`${dialog.occupant.fullName} chuyển đi`}
          description={c.status === 'Liquidating' ? `Không sau ngày trả phòng ${formatDate(c.actualEndDate)}.` : undefined}
          initial={{ moveOutDate: c.status === 'Liquidating' && c.actualEndDate < todayVN() ? c.actualEndDate : todayVN() }}
          validate={(v) => ({
            moveOutDate: !v.moveOutDate ? 'Chọn ngày.' : v.moveOutDate < dialog.occupant.moveInDate ? 'Không trước ngày vào ở.' : null,
          })}
          submitLabel="Ghi nhận chuyển đi"
          onSubmit={async (v) => {
            await contractsApi.endOccupancy(c.id, dialog.occupant.id, v)
            await refresh()
            toast.success('Đã ghi nhận chuyển đi.')
          }}
          onClose={() => setDialog(null)}
        >
          {(form) => <DateField label="Ngày chuyển đi" required {...form.field('moveOutDate')} />}
        </FormDialog>
      )}
    </>
  )
}

// Không giới hạn số người ở (PR-BR-06). Quan hệ / đồng ý giám hộ chỉ cảnh báo — không chặn (09/10/2026).
function AddOccupantDialog({ contract: c, onClose, onDone }) {
  const usedIds = c.occupants.filter((o) => !o.moveOutDate).map((o) => o.renterId)
  const defaultMoveIn = c.startDate > todayVN() ? c.startDate : todayVN()

  return (
    <FormDialog
      title="Thêm người ở"
      description="Quan hệ khai so với chủ hộ của hợp đồng."
      size="md"
      initial={{ renter: null, moveInDate: defaultMoveIn, expectedEndDate: '', relationshipType: '', relationship: '', guardianConsent: false, note: '' }}
      validate={(v) => ({
        renter: !v.renter ? 'Chọn người ở.' : null,
        moveInDate: !v.moveInDate ? 'Chọn ngày vào ở.' : v.moveInDate < c.startDate ? 'Không trước ngày bắt đầu hợp đồng.' : null,
      })}
      codeFields={{ CONTRACT_EXPIRED_EXTEND_FIRST: 'moveInDate', OCCUPANT_LIVES_ELSEWHERE: 'renter', OCCUPANCY_OVERLAP: 'renter' }}
      submitLabel="Thêm người ở"
      onSubmit={async (v) => {
        await contractsApi.addOccupant(c.id, {
          renterId: v.renter.id,
          moveInDate: v.moveInDate,
          expectedEndDate: v.expectedEndDate || null,
          relationshipType: v.relationshipType || null,
          relationship: v.relationship.trim() || null,
          guardianConsent: v.guardianConsent,
          note: v.note.trim() || null,
        })
        await onDone()
      }}
      onClose={onClose}
    >
      {(form) => {
        const v = form.values
        return (
          <>
            <RenterPicker label="Người ở" required value={v.renter} excludeIds={usedIds} onChange={(r) => form.setValue('renter', r)} error={form.errors.renter} />
            <FormGrid>
              <DateField label="Ngày vào ở" required {...form.field('moveInDate')} />
              <DateField label="Dự kiến ở đến" {...form.field('expectedEndDate')} />
              {v.renter && v.renter.id !== c.representativeRenterId && (
                <>
                  <SelectField
                    label="Quan hệ với chủ hộ"
                    placeholder="Chọn…"
                    hint={!v.relationshipType ? 'Nên khai — chưa khai vẫn lưu được, hệ thống nhắc sau' : undefined}
                    options={relationshipOptions(v.renter.gender)}
                    {...form.field('relationshipType')}
                  />
                  <TextField label={v.relationshipType === 'Other' ? 'Ghi rõ quan hệ' : 'Ghi chú quan hệ'} maxLength={50} {...form.field('relationship')} />
                </>
              )}
            </FormGrid>
            {v.renter && needsGuardianConsent(v, c.startDate) && (
              <CheckboxField
                label="Đã có ý kiến đồng ý của cha, mẹ hoặc người giám hộ"
                description="Người chưa đủ 18 tuổi — nên có, không chặn lưu."
                {...form.field('guardianConsent', { type: 'checkbox' })}
              />
            )}
          </>
        )
      }}
    </FormDialog>
  )
}
