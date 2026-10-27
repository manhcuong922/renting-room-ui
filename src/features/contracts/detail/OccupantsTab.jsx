import { ArrowRightLeft, Crown, LogOut, UserPlus, UserRoundPen } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { contractsApi } from '@/api'
import {
  Badge,
  Button,
  CheckboxField,
  ConfirmDialog,
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
import { OCCUPANT_ROLE_LABELS, RELATIONSHIP_GROUPS, RELATIONSHIP_LABELS, toOptions } from '@/constants/enums'
import { RenterPicker } from '@/features/renters/components/RenterPicker'
import { formatDate, todayVN } from '@/lib/format'
import { needsGuardianConsent, relationshipAllowed } from '../contractForm'
import { isCurrentOccupant } from '../contractRules'
import { ChangeRepresentativeDialog, MoveOccupantDialog } from './OccupantActions'

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
  const [dialog, setDialog] = useState(null) // { type: 'add' | 'representative' } | { type: 'end' | 'role' | 'move', occupant }
  const done = async (message) => {
    await refresh()
    toast.success(message)
  }
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
          {!o.isRepresentative && o.role === 'CoTenant' && <Badge tone="orange">Đồng thuê</Badge>}
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
        // Người đã ghi chuyển đi: không còn thao tác (409 OCCUPANT_ALREADY_MOVED_OUT).
        o.moveOutDate ? null : (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
            {actions.changeOccupantRole && !o.isRepresentative && (
              <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'role', occupant: o })}>
                {o.role === 'CoTenant' ? 'Bỏ đồng thuê' : 'Thành đồng thuê'}
              </Button>
            )}
            {actions.moveOccupant && (
              <Button size="sm" variant="secondary" icon={ArrowRightLeft} onClick={() => setDialog({ type: 'move', occupant: o })}>
                Sang phòng khác
              </Button>
            )}
            {actions.endOccupancy && (
              <Button size="sm" variant="secondary" icon={LogOut} onClick={() => setDialog({ type: 'end', occupant: o })}>
                Chuyển đi
              </Button>
            )}
          </span>
        ),
    },
  ]

  return (
    <>
      <Section
        title="Người ở"
        description={c.status === 'Draft' ? 'Ở bản nháp, sửa danh sách người ở trong "Sửa nháp" để đổi quan hệ / chủ hộ.' : 'Người ở chuyển đi giữa kỳ: bấm "Chuyển đi".'}
        actions={
          <>
            {actions.changeRepresentative && (
              <Button size="sm" variant="secondary" icon={UserRoundPen} onClick={() => setDialog({ type: 'representative' })}>
                Đổi người đứng tên
              </Button>
            )}
            {actions.addOccupant && (
              <Button size="sm" icon={UserPlus} onClick={() => setDialog({ type: 'add' })}>
                Thêm người ở
              </Button>
            )}
          </>
        }
      >
        {c.occupants.length ? <DataTable columns={columns} rows={c.occupants} caption="Người ở" /> : <EmptyState title="Chưa có người ở" description="Kích hoạt cần ít nhất 1 người ở." />}
      </Section>

      {c.representativeHistory?.length > 0 && (
        <Section title="Lịch sử người đứng tên" description={`Người đứng tên hiện tại: ${c.representativeName}${c.representativeSince ? ` (từ ${formatDate(c.representativeSince)})` : ''}.`}>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', display: 'grid', gap: 'var(--space-1)' }}>
            {c.representativeHistory.map((h) => (
              <li key={`${h.renterId}-${h.fromDate}`}>
                <Link to={`/renters/${h.renterId}`}>{h.fullName}</Link> — {formatDate(h.fromDate)} đến {formatDate(h.toDate)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {dialog?.type === 'representative' && <ChangeRepresentativeDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.type === 'move' && <MoveOccupantDialog contract={c} occupant={dialog.occupant} onClose={() => setDialog(null)} onDone={done} />}
      <ConfirmDialog
        open={dialog?.type === 'role'}
        onClose={() => setDialog(null)}
        title={dialog?.occupant?.role === 'CoTenant' ? `Bỏ vai trò đồng thuê của ${dialog?.occupant?.fullName ?? ''}?` : `Đặt ${dialog?.occupant?.fullName ?? ''} làm đồng thuê?`}
        message={
          dialog?.occupant?.role === 'CoTenant'
            ? 'Người này trở lại là người ở thường, không còn tên trên hợp đồng.'
            : 'Đồng thuê là người có tên trên hợp đồng cùng người đứng tên (chỉ mang tính giấy tờ, không chia tiền) và phải có số giấy tờ.'
        }
        confirmLabel={dialog?.occupant?.role === 'CoTenant' ? 'Bỏ đồng thuê' : 'Đặt làm đồng thuê'}
        onConfirm={async () => {
          const next = dialog.occupant.role === 'CoTenant' ? 'Resident' : 'CoTenant'
          await contractsApi.setOccupantRole(c.id, dialog.occupant.id, next)
          await done(next === 'CoTenant' ? 'Đã đặt làm đồng thuê.' : 'Đã bỏ vai trò đồng thuê.')
        }}
      />

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
      initial={{ renter: null, moveInDate: defaultMoveIn, expectedEndDate: '', relationshipType: '', relationship: '', guardianConsent: false, note: '', role: 'Resident' }}
      validate={(v) => ({
        renter: !v.renter ? 'Chọn người ở.' : null,
        moveInDate: !v.moveInDate ? 'Chọn ngày vào ở.' : v.moveInDate < c.startDate ? 'Không trước ngày bắt đầu hợp đồng.' : null,
      })}
      codeFields={{ OCCUPANT_LIVES_ELSEWHERE: 'renter', OCCUPANCY_OVERLAP: 'renter', CO_TENANT_ID_REQUIRED: 'role', REPRESENTATIVE_IS_RESIDENT_ELSEWHERE: 'renter', DATE_OUTSIDE_CONTRACT: 'moveInDate' }}
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
          role: v.role,
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
                    label="Vai trò"
                    options={toOptions(OCCUPANT_ROLE_LABELS)}
                    hint={v.role === 'CoTenant' ? 'Có tên trên hợp đồng — phải có số giấy tờ' : undefined}
                    {...form.field('role')}
                  />
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
