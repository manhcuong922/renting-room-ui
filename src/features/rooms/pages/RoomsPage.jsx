import { DoorOpen, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  Button,
  CheckboxField,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  QueryView,
  RadioGroup,
  SelectField,
  StatusBadge,
  TextField,
  Toolbar,
} from '@/components/ui'
import { ROOM_STATUS } from '@/constants/enums'
import { ContractFlagBadges } from '@/features/contracts/components/ContractBadges'
import { usePropertyOptions } from '@/features/shared/queries'
import { useListParams } from '@/hooks/useListParams'
import { formatMoney } from '@/lib/format'
import { RoomFormDialog } from '../components/RoomFormDialog'
import { RoomDebt, RoomGrid } from '../components/RoomGrid'
import { formatOccupants } from '../roomForm'
import { useRoomList } from '../hooks'

const DEFAULTS = { search: '', propertyId: '', status: '', floor: '', overdue: false, view: 'grid', page: 1 }
const STATUS_OPTIONS = Object.entries(ROOM_STATUS).map(([value, s]) => ({ value, label: s.label }))
const VIEW_OPTIONS = [
  {
    value: 'grid',
    label: (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <LayoutGrid size={14} aria-hidden /> Sơ đồ
      </span>
    ),
  },
  {
    value: 'list',
    label: (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <List size={14} aria-hidden /> Bảng
      </span>
    ),
  },
]

const COLUMNS = [
  {
    key: 'code',
    header: 'Phòng',
    primary: true,
    cell: (r) => (
      <Link to={`/rooms/${r.id}`}>
        <strong>
          {r.propertyCode} · {r.code}
        </strong>
      </Link>
    ),
  },
  { key: 'floor', header: 'Tầng', cell: (r) => r.floor ?? '—' },
  { key: 'area', header: 'Diện tích', cell: (r) => (r.areaM2 ? `${r.areaM2} m²` : '—') },
  { key: 'rent', header: 'Giá niêm yết', align: 'right', cell: (r) => formatMoney(r.listedRent) },
  { key: 'renter', header: 'Người đại diện', cell: (r) => r.currentContract?.representativeName ?? '—' },
  { key: 'occupants', header: 'Số người', cell: (r) => formatOccupants(r.currentContract?.occupantCount, r.maxOccupants) },
  { key: 'debt', header: 'Công nợ', cell: (r) => <RoomDebt room={r} /> },
  {
    key: 'status',
    header: 'Trạng thái',
    cell: (r) => (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
        <StatusBadge map={ROOM_STATUS} value={r.status} />
        <ContractFlagBadges flags={r.currentContract?.flags} />
      </span>
    ),
  },
]

// docs/api/rooms.md#danh-sách — mặc định ẩn phòng ngừng dùng (lọc "Ngừng dùng" để xem).
export default function RoomsPage() {
  const { params, set, searchInput } = useListParams(DEFAULTS)
  const [creating, setCreating] = useState(false)
  const properties = usePropertyOptions()
  const grid = params.view === 'grid'
  const query = useRoomList({
    propertyId: params.propertyId || undefined,
    status: params.status || undefined,
    floor: params.floor || undefined,
    overdue: params.overdue || undefined,
    search: params.search || undefined,
    page: params.page,
    pageSize: grid ? 100 : 30,
  })

  return (
    <>
      <PageHeader
        title="Phòng"
        description="Sơ đồ phòng theo tầng, trạng thái do hệ thống tính từ hợp đồng và bảo trì."
        actions={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            Thêm phòng
          </Button>
        }
      />

      <Toolbar>
        <TextField icon={Search} type="search" placeholder="Tìm mã phòng…" aria-label="Tìm phòng" {...searchInput} />
        <SelectField
          aria-label="Khu"
          placeholder="Mọi khu"
          options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
          value={params.propertyId}
          onChange={(e) => set({ propertyId: e.target.value })}
        />
        <SelectField aria-label="Trạng thái" placeholder="Mọi trạng thái (trừ ngừng dùng)" options={STATUS_OPTIONS} value={params.status} onChange={(e) => set({ status: e.target.value })} />
        <TextField aria-label="Tầng" placeholder="Tầng" value={params.floor} maxLength={10} onChange={(e) => set({ floor: e.target.value.trim() })} />
        <CheckboxField label="Quá hạn thanh toán" checked={params.overdue} onChange={(e) => set({ overdue: e.target.checked })} />
        <RadioGroup options={VIEW_OPTIONS} value={params.view} onChange={(view) => set({ view })} />
      </Toolbar>

      <QueryView
        query={query}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon={DoorOpen} title="Không có phòng phù hợp" description="Đổi bộ lọc hoặc thêm phòng mới." />}
      >
        {(data) => (
          <>
            {grid ? (
              <RoomGrid rooms={data.items} showProperty={!params.propertyId} />
            ) : (
              <DataTable columns={COLUMNS} rows={data.items} rowHref={(r) => `/rooms/${r.id}`} stale={query.isPlaceholderData} caption="Danh sách phòng" />
            )}
            <Pagination {...data} disabled={query.isPlaceholderData} onPageChange={(page) => set({ page })} />
          </>
        )}
      </QueryView>

      {creating && <RoomFormDialog open propertyId={params.propertyId || undefined} onClose={() => setCreating(false)} />}
    </>
  )
}
