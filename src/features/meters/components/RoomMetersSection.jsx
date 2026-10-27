import { Gauge, History, Plus, Repeat, Unplug } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, CheckboxField, DataTable, EmptyState, QueryView, Section } from '@/components/ui'
import { READING_KIND_LABELS } from '@/constants/enums'
import { usePropertyFees, useRoomMeters } from '@/features/shared/queries'
import { formatDate } from '@/lib/format'
import { formatReading } from '../meterRules'
import { InstallMeterDialog, RemoveMeterDialog, ReplaceMeterDialog } from './MeterDialogs'
import { MeterReadingsDialog } from './MeterReadingsDialog'

/**
 * Công tơ điện nước của phòng (docs/api/meters.md). Công tơ đi theo phòng, không theo hợp đồng;
 * mỗi phòng tối đa 1 công tơ đang hoạt động cho mỗi khoản — đã có thì "Thay", chưa có mới "Lắp".
 */
export function RoomMetersSection({ room }) {
  const [includeRemoved, setIncludeRemoved] = useState(false)
  const [dialog, setDialog] = useState(null) // { type: 'install' } | { type: 'replace' | 'remove' | 'readings', meter }
  const query = useRoomMeters(room.id, { includeRemoved })
  const fees = usePropertyFees(room.propertyId)
  const archived = room.status === 'Archived'

  const activeFeeIds = new Set((query.data ?? []).filter((m) => m.isActive).map((m) => m.feeTypeId))
  const installable = (fees.data ?? []).filter((f) => f.group === 'Metered' && !f.isArchived && !activeFeeIds.has(f.id))
  const close = () => setDialog(null)

  const columns = [
    {
      key: 'fee',
      header: 'Công tơ',
      primary: true,
      cell: (m) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <strong>{m.feeTypeName}</strong>
          {m.serialNo && <span style={{ color: 'var(--color-text-muted)' }}>{m.serialNo}</span>}
          {!m.isActive && <Badge>{m.replacedByMeterId ? 'Đã thay' : 'Đã tháo'}</Badge>}
        </span>
      ),
    },
    {
      key: 'period',
      header: 'Thời gian',
      cell: (m) => `${formatDate(m.installedDate)} → ${m.removedDate ? formatDate(m.removedDate) : 'nay'}`,
    },
    {
      key: 'latest',
      header: 'Chỉ số mới nhất',
      cell: (m) =>
        m.latestReading
          ? `${formatReading(m.latestReading.value)} ${m.unit} · ${formatDate(m.latestReading.readingDate)} (${READING_KIND_LABELS[m.latestReading.kind] ?? m.latestReading.kind})`
          : '—',
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      cell: (m) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
          <Button size="sm" variant="secondary" icon={History} onClick={() => setDialog({ type: 'readings', meter: m })}>
            Lịch sử
          </Button>
          {m.isActive && (
            <>
              <Button size="sm" variant="secondary" icon={Repeat} onClick={() => setDialog({ type: 'replace', meter: m })}>
                Thay
              </Button>
              <Button size="sm" variant="ghost" icon={Unplug} onClick={() => setDialog({ type: 'remove', meter: m })}>
                Tháo
              </Button>
            </>
          )}
        </span>
      ),
    },
  ]

  return (
    <Section
      title="Công tơ điện nước"
      description="Điện, nước tính theo công tơ của phòng, từ chỉ số ngày nhận phòng."
      actions={
        <>
          <CheckboxField label="Hiện cả công tơ cũ" checked={includeRemoved} onChange={(e) => setIncludeRemoved(e.target.checked)} />
          {!archived && installable.length > 0 && (
            <Button size="sm" icon={Plus} onClick={() => setDialog({ type: 'install' })}>
              Lắp công tơ
            </Button>
          )}
        </>
      }
    >
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            icon={Gauge}
            title="Phòng chưa có công tơ"
            description="Phòng tính nước theo đầu người thì không cần công tơ nước — gắn dịch vụ theo người vào hợp đồng."
          />
        }
        errorTitle="Không tải được công tơ"
      >
        {(meters) => <DataTable columns={columns} rows={meters} caption="Công tơ của phòng" />}
      </QueryView>

      {dialog?.type === 'install' && <InstallMeterDialog room={room} fees={installable} onClose={close} />}
      {dialog?.type === 'replace' && <ReplaceMeterDialog meter={dialog.meter} onClose={close} />}
      {dialog?.type === 'remove' && <RemoveMeterDialog meter={dialog.meter} occupied={room.status === 'Occupied'} onClose={close} />}
      {dialog?.type === 'readings' && <MeterReadingsDialog meter={dialog.meter} onClose={close} />}
    </Section>
  )
}
