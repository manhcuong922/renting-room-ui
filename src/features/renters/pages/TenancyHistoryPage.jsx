import { useQuery } from '@tanstack/react-query'
import { History, Search } from 'lucide-react'
import { Link } from 'react-router'
import { queryKeys, roomsApi } from '@/api'
import { Card, DataTable, EmptyState, PageHeader, QueryView, SelectField, TextField, Toolbar } from '@/components/ui'
import { TENANCY_ROLE_LABELS } from '@/constants/enums'
import { usePropertyOptions } from '@/features/shared/queries'
import { useListParams } from '@/hooks/useListParams'
import { formatDate } from '@/lib/format'

const DEFAULTS = { search: '', propertyId: '' }
const MIN_LENGTH = 2

const columns = [
  { key: 'name', header: 'Họ tên', primary: true, cell: (r) => <Link to={`/renters/${r.renterId}`}>{r.fullName}</Link> },
  { key: 'room', header: 'Phòng', cell: (r) => <Link to={`/rooms/${r.roomId}`}>{r.roomCode}</Link> },
  { key: 'contract', header: 'Hợp đồng', cell: (r) => <Link to={`/contracts/${r.contractId}`}>{r.contractNo}</Link> },
  { key: 'role', header: 'Vai trò', cell: (r) => TENANCY_ROLE_LABELS[r.role] ?? r.role },
  { key: 'from', header: 'Từ ngày', cell: (r) => formatDate(r.fromDate) },
  { key: 'to', header: 'Đến ngày', cell: (r) => (r.toDate ? formatDate(r.toDate) : 'Đang ở') },
]

/**
 * Tìm "ai đã ở phòng nào" theo tên (rooms.md: GET /tenancy-history?search=) — không phân biệt dấu / hoa thường, tối thiểu 2 ký tự,
 * tối đa 50 người khớp và 200 dòng. Ra cả người từng đứng tên, với khoảng ngày họ đứng tên.
 */
export default function TenancyHistoryPage() {
  const { params, set, searchInput } = useListParams(DEFAULTS)
  const properties = usePropertyOptions()
  const term = params.search.trim()
  const ready = term.length >= MIN_LENGTH
  const filter = { search: term, propertyId: params.propertyId || undefined }
  const query = useQuery({
    queryKey: queryKeys.rooms.tenancySearch(filter),
    queryFn: ({ signal }) => roomsApi.searchTenancy(filter, { signal }),
    enabled: ready,
  })

  return (
    <>
      <PageHeader backTo="/renters" backLabel="Người thuê" title="Ai đã ở phòng nào" description="Tìm theo họ tên để biết một người đã ở hoặc đứng tên phòng nào, từ ngày nào tới ngày nào." />
      <Toolbar>
        <TextField icon={Search} type="search" placeholder="Họ tên (không cần dấu), ít nhất 2 ký tự…" aria-label="Tìm theo họ tên" {...searchInput} />
        <SelectField
          aria-label="Khu trọ"
          placeholder="Mọi khu"
          options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          value={params.propertyId}
          onChange={(e) => set({ propertyId: e.target.value })}
        />
      </Toolbar>
      {!ready ? (
        <Card>
          <EmptyState icon={History} title="Nhập tên để tìm" description="Gõ ít nhất 2 ký tự của họ tên. Hồ sơ đã xóa theo yêu cầu của người thuê hiện “Đã ẩn danh #…”." />
        </Card>
      ) : (
        <QueryView
          query={query}
          isEmpty={(d) => d.length === 0}
          empty={
            <Card>
              <EmptyState icon={History} title="Không tìm thấy ai khớp tên này" />
            </Card>
          }
          errorTitle="Không tìm được lịch sử thuê"
        >
          {(rows) => <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.renterId}-${r.contractId}-${r.roomId}-${r.fromDate}-${r.role}`} caption="Lịch sử thuê theo tên" />}
        </QueryView>
      )}
    </>
  )
}
