import { Plus, Search, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  QueryView,
  SelectField,
  StatusBadge,
  TempPasswordDialog,
  TextField,
  Toolbar,
} from '@/components/ui'
import { ORGANIZATION_STATUS } from '@/constants/enums'
import { useListParams } from '@/hooks/useListParams'
import { formatDateTime } from '@/lib/format'
import { CreateOrganizationDialog } from '../components/CreateOrganizationDialog'
import { useOrganizationList } from '../hooks'

const DEFAULTS = { search: '', status: '', page: 1 }
const STATUS_OPTIONS = Object.entries(ORGANIZATION_STATUS).map(([value, s]) => ({ value, label: s.label }))

const COLUMNS = [
  {
    key: 'code',
    header: 'Tổ chức',
    primary: true,
    cell: (o) => (
      <Link to={`/admin/organizations/${o.id}`}>
        <strong>{o.code}</strong>
        <span style={{ color: 'var(--color-text)', fontWeight: 400 }}> · {o.name}</span>
      </Link>
    ),
  },
  { key: 'contact', header: 'Liên hệ', cell: (o) => [o.contactName, o.contactPhone].filter(Boolean).join(' · ') || '—' },
  { key: 'status', header: 'Trạng thái', cell: (o) => <StatusBadge map={ORGANIZATION_STATUS} value={o.status} /> },
  { key: 'createdAt', header: 'Ngày tạo', cell: (o) => formatDateTime(o.createdAt) },
]

// docs/api/admin.md — chỉ SystemAdmin.
export default function OrganizationsPage() {
  const navigate = useNavigate()
  const { params, set, searchInput } = useListParams(DEFAULTS)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(null)
  const query = useOrganizationList({
    search: params.search || undefined,
    status: params.status || undefined,
    page: params.page,
    pageSize: 20,
  })

  const closeCreated = () => {
    const id = created?.organizationId
    setCreated(null)
    if (id) void navigate(`/admin/organizations/${id}`)
  }

  return (
    <>
      <PageHeader
        title="Tổ chức chủ trọ"
        description="Tạo tổ chức, tạm ngưng và quản lý tài khoản chủ trọ / phó quản lý."
        actions={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            Tạo tổ chức
          </Button>
        }
      />

      <Toolbar>
        <TextField icon={Search} type="search" placeholder="Tìm theo mã hoặc tên…" aria-label="Tìm tổ chức" maxLength={100} {...searchInput} />
        <SelectField
          aria-label="Trạng thái"
          placeholder="Mọi trạng thái"
          options={STATUS_OPTIONS}
          value={params.status}
          onChange={(e) => set({ status: e.target.value })}
        />
      </Toolbar>

      <QueryView
        query={query}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon={ShieldCheck}
            title="Không có tổ chức nào"
            description={params.search ? 'Thử từ khóa khác.' : 'Bấm "Tạo tổ chức" để bắt đầu.'}
          />
        }
      >
        {(data) => (
          <>
            <DataTable
              columns={COLUMNS}
              rows={data.items}
              rowHref={(o) => `/admin/organizations/${o.id}`}
              stale={query.isPlaceholderData}
              caption="Danh sách tổ chức"
            />
            <Pagination {...data} disabled={query.isPlaceholderData} onPageChange={(page) => set({ page })} />
          </>
        )}
      </QueryView>

      <CreateOrganizationDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(result) => {
          setCreating(false)
          setCreated(result)
        }}
      />
      <TempPasswordDialog title="Đã tạo tổ chức — tài khoản chủ trọ" data={created} onClose={closeCreated} />
    </>
  )
}
