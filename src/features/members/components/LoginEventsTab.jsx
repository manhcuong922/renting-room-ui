import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useState } from 'react'
import { membersApi, queryKeys } from '@/api'
import { Badge, DataTable, EmptyState, Pagination, QueryView, SelectField, Toolbar } from '@/components/ui'
import { LOGIN_OUTCOME_LABELS } from '@/constants/enums'
import { formatDateTime } from '@/lib/format'
import styles from './LoginEventsTab.module.css'

const RESULT_OPTIONS = [
  { value: 'true', label: 'Thành công' },
  { value: 'false', label: 'Thất bại' },
]

const columns = [
  { key: 'time', header: 'Thời điểm', primary: true, cell: (e) => formatDateTime(e.occurredAt) },
  { key: 'user', header: 'Tài khoản', cell: (e) => e.fullName ?? '—' },
  {
    key: 'result',
    header: 'Kết quả',
    cell: (e) => <Badge tone={e.success ? 'success' : 'danger'}>{e.success ? 'Thành công' : 'Thất bại'}</Badge>,
  },
  { key: 'reason', header: 'Chi tiết', cell: (e) => LOGIN_OUTCOME_LABELS[e.reason] ?? e.reason },
  { key: 'ip', header: 'Địa chỉ IP', hideOnMobile: true, cell: (e) => e.ipAddress ?? '—' },
]

/**
 * Nhật ký đăng nhập của các tài khoản trong tổ chức (members.md#nhật-ký-đăng-nhập) — chỉ chủ trọ.
 * Mỗi lần đăng nhập thành công / thất bại là một dòng, mới nhất trước; hệ thống giữ 180 ngày.
 * `members`: danh sách thành viên đã tải ở tab bên cạnh, dùng cho ô lọc theo tài khoản.
 */
export function LoginEventsTab({ members = [] }) {
  const [filters, setFilters] = useState({ userId: '', success: '', page: 1 })
  const change = (changes) => setFilters((f) => ({ ...f, page: 1, ...changes }))
  const params = { userId: filters.userId || undefined, success: filters.success || undefined, page: filters.page, pageSize: 20 }

  const query = useQuery({
    queryKey: queryKeys.members.loginEvents(params),
    queryFn: ({ signal }) => membersApi.loginEvents(params, { signal }),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <Toolbar>
        <SelectField
          aria-label="Lọc theo tài khoản"
          placeholder="Mọi tài khoản"
          options={members.map((m) => ({ value: m.id, label: m.fullName }))}
          value={filters.userId}
          onChange={(e) => change({ userId: e.target.value })}
        />
        <SelectField
          aria-label="Lọc theo kết quả"
          placeholder="Mọi kết quả"
          options={RESULT_OPTIONS}
          value={filters.success}
          onChange={(e) => change({ success: e.target.value })}
        />
      </Toolbar>

      <QueryView
        query={query}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon={History}
            title="Chưa có lần đăng nhập nào"
            description="Nhật ký giữ 180 ngày. Lần thử với tên đăng nhập không tồn tại không được ghi ở đây."
          />
        }
        errorTitle="Không tải được nhật ký đăng nhập"
      >
        {(data) => (
          <>
            <DataTable
              columns={columns}
              rows={data.items}
              rowClassName={(e) => (e.success ? undefined : styles.failed)}
              caption="Nhật ký đăng nhập"
              stale={query.isPlaceholderData}
            />
            <Pagination {...data} disabled={query.isPlaceholderData} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </QueryView>
    </>
  )
}
