import { FilePlus, FileText, Search } from 'lucide-react'
import { Link } from 'react-router'
import {
  ButtonLink,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  QueryView,
  RadioGroup,
  SelectField,
  Tabs,
  TextField,
  Toolbar,
} from '@/components/ui'
import { CONTRACT_STATUS, CONTRACT_TYPE_LABELS } from '@/constants/enums'
import { usePropertyOptions } from '@/features/shared/queries'
import { useListParams } from '@/hooks/useListParams'
import { formatMoney } from '@/lib/format'
import { ContractBadges } from '../components/ContractBadges'
import { formatContractTerm } from '../contractRules'
import { useContractList } from '../hooks'

const DEFAULTS = { search: '', status: '', quick: '', propertyId: '', page: 1 }

const STATUS_TABS = [{ id: '', label: 'Tất cả' }, ...Object.entries(CONTRACT_STATUS).map(([id, s]) => ({ id, label: s.label }))]
const QUICK_FILTERS = [
  { value: '', label: 'Không lọc' },
  { value: 'expiring', label: 'Sắp hết hạn (30 ngày)' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'noDeposit', label: 'Không cọc' },
]
const QUICK_QUERY = {
  expiring: { expiringWithinDays: 30 },
  overdue: { overdue: true },
  noDeposit: { hasDeposit: false },
}

const COLUMNS = [
  {
    key: 'no',
    header: 'Số HĐ',
    primary: true,
    cell: (c) => (
      <div>
        <Link to={`/contracts/${c.id}`}>
          <strong>{c.contractNo}</strong>
        </Link>
        {c.contractType && <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{CONTRACT_TYPE_LABELS[c.contractType]}</div>}
      </div>
    ),
  },
  { key: 'room', header: 'Khu / phòng', cell: (c) => `${c.propertyCode} · ${c.roomCode}` },
  { key: 'rep', header: 'Người đại diện', cell: (c) => c.representativeName },
  {
    key: 'term',
    header: 'Thời hạn',
    cell: formatContractTerm,
  },
  { key: 'rent', header: 'Giá hiện tại', align: 'right', cell: (c) => formatMoney(c.currentRent) },
  { key: 'people', header: 'Số người', cell: (c) => c.occupantCount },
  { key: 'status', header: 'Trạng thái', cell: (c) => <ContractBadges contract={c} /> },
]

// docs/api/contracts.md#danh-sách — sắp theo ngày bắt đầu mới nhất.
export default function ContractsPage() {
  const { params, set, searchInput } = useListParams(DEFAULTS)
  const properties = usePropertyOptions()
  const query = useContractList({
    status: params.status || undefined,
    propertyId: params.propertyId || undefined,
    search: params.search || undefined,
    ...QUICK_QUERY[params.quick],
    page: params.page,
    pageSize: 20,
  })

  return (
    <>
      <PageHeader
        title="Hợp đồng"
        description="Tạo, kích hoạt, phụ lục, báo trả phòng và thanh lý hợp đồng thuê."
        actions={
          <ButtonLink to="/contracts/new" icon={FilePlus}>
            Tạo hợp đồng
          </ButtonLink>
        }
      />

      <Tabs tabs={STATUS_TABS} value={params.status} onChange={(status) => set({ status })} label="Lọc theo trạng thái" />

      <Toolbar>
        <TextField icon={Search} type="search" placeholder="Số hợp đồng…" aria-label="Tìm số hợp đồng" {...searchInput} />
        <SelectField
          aria-label="Khu"
          placeholder="Mọi khu"
          options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
          value={params.propertyId}
          onChange={(e) => set({ propertyId: e.target.value })}
        />
        <RadioGroup options={QUICK_FILTERS} value={params.quick} onChange={(quick) => set({ quick })} />
      </Toolbar>

      <QueryView
        query={query}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon={FileText} title="Không có hợp đồng phù hợp" description="Đổi bộ lọc hoặc tạo hợp đồng mới." />}
      >
        {(data) => (
          <>
            <DataTable columns={COLUMNS} rows={data.items} rowHref={(c) => `/contracts/${c.id}`} stale={query.isPlaceholderData} caption="Danh sách hợp đồng" />
            <Pagination {...data} disabled={query.isPlaceholderData} onPageChange={(page) => set({ page })} />
          </>
        )}
      </QueryView>
    </>
  )
}
