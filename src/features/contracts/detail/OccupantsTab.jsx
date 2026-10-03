import { Crown, LogOut, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { contractsApi } from '@/api'
import {
  Alert,
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

function AddOccupantDialog({ contract: c, onClose, onDone }) {
  const [capacityExceeded, setCapacityExceeded] = useState(false)
  const usedIds = c.occupants.filter((o) => !o.moveOutDate).map((o) => o.renterId)
  const defaultMoveIn = c.startDate > todayVN() ? c.startDate : todayVN()

  return (
    <FormDialog
      title="Thêm người ở"
      description="Quan hệ khai so với chủ hộ của hợp đồng."
      size="md"
      initial={{ renter: null, moveInDate: defaultMoveIn, expectedEndDate: '', relationshipType: '', relationship: '', guardianConsent: false, note: '', overrideCapacity: false }}
      validate={(v) => ({
        renter: !v.renter ? 'Chọn người ở.' : null,
        moveInDate: !v.moveInDate ? 'Chọn ngày vào ở.' : v.moveInDate < c.startDate ? 'Không trước ngày bắt đầu hợp đồng.' : null,
        relationshipType: v.renter && v.renter.id !== c.representativeRenterId && !v.relationshipType ? 'Chọn quan hệ với chủ hộ.' : null,
        relationship: v.relationshipType === 'Other' && !v.relationship.trim() ? 'Ghi rõ quan hệ.' : null,
        guardianConsent: v.renter && needsGuardianConsent(v, c.startDate) && !v.guardianConsent ? 'Cần ý kiến đồng ý của cha mẹ / người giám hộ.' : null,
      })}
      submitLabel="Thêm người ở"
      onSubmit={async (v) => {
        try {
          await contractsApi.addOccupant(c.id, {
            renterId: v.renter.id,
            moveInDate: v.moveInDate,
            expectedEndDate: v.expectedEndDate || null,
            relationshipType: v.relationshipType || null,
            relationship: v.relationship.trim() || null,
            guardianConsent: v.guardianConsent,
            note: v.note.trim() || null,
            overrideCapacity: v.overrideCapacity,
          })
        } catch (error) {
          // Vượt sức chứa → người dùng xác nhận "vẫn thêm" rồi gửi lại với overrideCapacity.
          if (error.code === 'ROOM_CAPACITY_EXCEEDED') setCapacityExceeded(true)
          throw error
        }
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
                  <SelectField label="Quan hệ với chủ hộ" required placeholder="Chọn…" options={relationshipOptions(v.renter.gender)} {...form.field('relationshipType')} />
                  <TextField label={v.relationshipType === 'Other' ? 'Ghi rõ quan hệ' : 'Ghi chú quan hệ'} required={v.relationshipType === 'Other'} maxLength={50} {...form.field('relationship')} />
                </>
              )}
            </FormGrid>
            {v.renter && needsGuardianConsent(v, c.startDate) && (
              <CheckboxField label="Đã có ý kiến đồng ý của cha, mẹ hoặc người giám hộ" {...form.field('guardianConsent', { type: 'checkbox' })} />
            )}
            {capacityExceeded && (
              <>
                <Alert tone="warning">Phòng đã đủ sức chứa. Xác nhận nếu vẫn muốn thêm (VD gia đình có con nhỏ) — thao tác được ghi log.</Alert>
                <CheckboxField label="Tôi xác nhận vượt sức chứa phòng" {...form.field('overrideCapacity', { type: 'checkbox' })} />
              </>
            )}
          </>
        )
      }}
    </FormDialog>
  )
}
