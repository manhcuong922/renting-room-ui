import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { useState } from 'react'
import { auditApi, queryKeys } from '@/api'
import { Badge, DataTable, EmptyState, Pagination, QueryView } from '@/components/ui'
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from '@/constants/enums'
import { formatDateTime } from '@/lib/format'
import styles from './AuditLogList.module.css'

const ACTION_TONE = { Created: 'success', Updated: 'info', Deleted: 'danger', Anonymized: 'danger', RevealIdNumber: 'warning', PrintWithIdNumbers: 'warning', ExportWithIdNumbers: 'warning' }
const MAX_INLINE = 80

/** Giá trị trong `changes` → chuỗi đọc được. Server lưu một số trường (issues, bản chụp giá…) dưới dạng chuỗi JSON. */
function toText(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' && /^[[{]/.test(value)) {
    try {
      return JSON.stringify(JSON.parse(value))
    } catch {
      return value
    }
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function Value({ value }) {
  const textValue = toText(value)
  if (textValue.length <= MAX_INLINE) return textValue
  return (
    <details className={styles.long}>
      <summary>{textValue.slice(0, MAX_INLINE)}…</summary>
      <span>{textValue}</span>
    </details>
  )
}
const isDiff = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && ('old' in value || 'new' in value)

/** `changes`: sửa ⇒ { field: { old, new } }; tạo / xóa ⇒ giá trị các trường; sự kiện ⇒ chi tiết. Trường nhạy cảm đã là "[redacted]". */
function Changes({ changes }) {
  if (changes === null || changes === undefined) return '—'
  if (typeof changes !== 'object' || Array.isArray(changes)) return <Value value={changes} />
  const entries = Object.entries(changes)
  if (entries.length === 0) return '—'
  return (
    <ul className={styles.changes}>
      {entries.map(([field, value]) => (
        <li key={field}>
          <span className={styles.field}>{field}:</span>{' '}
          {isDiff(value) ? (
            <>
              <span className={styles.old}>
                <Value value={value.old} />
              </span>{' '}
              → <Value value={value.new} />
            </>
          ) : (
            <Value value={value} />
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Bảng nhật ký thao tác (docs/api/audit.md), mới nhất trước, phân trang.
 * `filter`: { entityType, entityId, userId, action, from, to } — truyền entityType + entityId để xem lịch sử của một đối tượng.
 * Chỉ chủ trọ gọi được: nơi dùng phải tự ẩn với phó quản lý (Permission.AuditView).
 */
export function AuditLogList({ filter, showEntity = true, emptyTitle = 'Chưa có thao tác nào được ghi' }) {
  const [paging, setPaging] = useState({ key: '', page: 1 })
  const filterKey = JSON.stringify(filter)
  // Đổi bộ lọc → về trang 1.
  const page = paging.key === filterKey ? paging.page : 1
  const params = { ...filter, page, pageSize: 20 }
  const query = useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: ({ signal }) => auditApi.list(params, { signal }),
    placeholderData: keepPreviousData,
  })

  const columns = [
    { key: 'time', header: 'Thời điểm', primary: true, cell: (l) => formatDateTime(l.occurredAt) },
    { key: 'user', header: 'Người làm', cell: (l) => l.userName ?? 'Hệ thống' },
    { key: 'action', header: 'Thao tác', cell: (l) => <Badge tone={ACTION_TONE[l.action] ?? 'neutral'}>{AUDIT_ACTION_LABELS[l.action] ?? l.action}</Badge> },
    ...(showEntity ? [{ key: 'entity', header: 'Đối tượng', cell: (l) => AUDIT_ENTITY_LABELS[l.entityType] ?? l.entityType }] : []),
    { key: 'changes', header: 'Thay đổi', cell: (l) => <Changes changes={l.changes} /> },
    { key: 'ip', header: 'IP', hideOnMobile: true, cell: (l) => l.ipAddress ?? '—' },
  ]

  return (
    <QueryView query={query} isEmpty={(d) => d.items.length === 0} empty={<EmptyState icon={ScrollText} title={emptyTitle} />} errorTitle="Không tải được nhật ký">
      {(data) => (
        <>
          <DataTable columns={columns} rows={data.items} caption="Nhật ký thao tác" stale={query.isPlaceholderData} />
          <Pagination {...data} disabled={query.isPlaceholderData} onPageChange={(next) => setPaging({ key: filterKey, page: next })} />
        </>
      )}
    </QueryView>
  )
}
