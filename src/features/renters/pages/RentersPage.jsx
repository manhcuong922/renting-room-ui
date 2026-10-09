import { FileSpreadsheet, IdCard, Search, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, DataTable, EmptyState, PageHeader, Pagination, QueryView, SelectField, TextField, Toolbar } from '@/components/ui'
import { GENDER_LABELS, ID_DOCUMENT_TYPE_LABELS, toOptions } from '@/constants/enums'
import { ExportRentersDialog } from '@/features/exports/ExportRentersDialog'
import { useListParams } from '@/hooks/useListParams'
import { formatDate } from '@/lib/format'
import { RenterFormDialog } from '../components/RenterFormDialog'
import { useRenterList } from '../hooks'

// Số giấy tờ KHÔNG đặt trên URL (lịch sử trình duyệt, log proxy, Referer) — giữ trong state, tìm qua POST /renters/search.
const DEFAULTS = { q: '', page: 1 }

const COLUMNS = [
  {
    key: 'name',
    header: 'Họ tên',
    primary: true,
    cell: (r) => (
      <Link to={`/renters/${r.id}`}>
        <strong>{r.fullName}</strong>
      </Link>
    ),
  },
  { key: 'dob', header: 'Ngày sinh', cell: (r) => `${formatDate(r.dateOfBirth)} · ${GENDER_LABELS[r.gender] ?? ''}` },
  { key: 'phone', header: 'Điện thoại', cell: (r) => r.phone ?? '—' },
  { key: 'id', header: 'Giấy tờ', cell: (r) => (r.idType ? `${ID_DOCUMENT_TYPE_LABELS[r.idType] ?? r.idType} ${r.idNumberMasked ?? ''}` : 'Chưa có giấy tờ') },
  { key: 'address', header: 'Thường trú', hideOnMobile: true, cell: (r) => r.permanentAddress ?? '—' },
]

// docs/api/renters.md#tìm-kiếm — `q`: một phần họ tên (không cần dấu) hoặc đúng SĐT; số giấy tờ: khớp CHÍNH XÁC (POST /renters/search).
export default function RentersPage() {
  const navigate = useNavigate()
  const { params, set, searchInput } = useListParams(DEFAULTS, { searchKey: 'q' })
  const [idInput, setIdInput] = useState('')
  const [idSearch, setIdSearch] = useState({ idNumber: '', idType: '' })
  const [dialog, setDialog] = useState(null) // 'create' | 'export'
  const query = useRenterList({
    q: params.q || undefined,
    idNumber: idSearch.idNumber || undefined,
    idType: idSearch.idNumber ? idSearch.idType || undefined : undefined,
    page: params.page,
    pageSize: 20,
  })
  const searchById = (changes) => {
    setIdSearch((prev) => ({ ...prev, ...changes }))
    set({ page: 1 })
  }

  return (
    <>
      <PageHeader
        title="Người thuê"
        description="Hồ sơ người thuê và người ở cùng — dùng chung cho mọi hợp đồng của tổ chức."
        actions={
          <>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setDialog('export')}>
              Xuất Excel
            </Button>
            <Button icon={UserPlus} onClick={() => setDialog('create')}>
              Thêm người thuê
            </Button>
          </>
        }
      />

      <Toolbar>
        <TextField icon={Search} type="search" placeholder="Họ tên (không cần dấu) hoặc SĐT…" aria-label="Tìm người thuê" {...searchInput} />
        <form
          style={{ display: 'contents' }}
          onSubmit={(e) => {
            e.preventDefault()
            searchById({ idNumber: idInput.replace(/\s+/g, '') })
          }}
        >
          <TextField
            icon={IdCard}
            placeholder="Số giấy tờ (đủ số) + Enter"
            aria-label="Tìm theo số giấy tờ"
            value={idInput}
            onChange={(e) => {
              setIdInput(e.target.value)
              if (!e.target.value) searchById({ idNumber: '' })
            }}
          />
        </form>
        {idSearch.idNumber && (
          <SelectField
            aria-label="Loại giấy tờ"
            placeholder="Mọi loại giấy tờ"
            options={toOptions(ID_DOCUMENT_TYPE_LABELS)}
            value={idSearch.idType}
            onChange={(e) => searchById({ idType: e.target.value })}
          />
        )}
      </Toolbar>

      <QueryView
        query={query}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon={Users}
            title={params.q || idSearch.idNumber ? 'Không tìm thấy người thuê' : 'Chưa có hồ sơ người thuê'}
            description={idSearch.idNumber ? 'Tìm theo số giấy tờ cần nhập đủ, chính xác. Hồ sơ đã ẩn danh không hiện trong tìm kiếm.' : undefined}
          />
        }
      >
        {(data) => (
          <>
            <DataTable columns={COLUMNS} rows={data.items} rowHref={(r) => `/renters/${r.id}`} stale={query.isPlaceholderData} caption="Danh sách người thuê" />
            <Pagination {...data} disabled={query.isPlaceholderData} onPageChange={(page) => set({ page })} />
          </>
        )}
      </QueryView>

      {dialog === 'create' && <RenterFormDialog onClose={() => setDialog(null)} onSaved={(r) => void navigate(`/renters/${r.id}`)} />}
      {dialog === 'export' && <ExportRentersDialog open onClose={() => setDialog(null)} />}
    </>
  )
}
