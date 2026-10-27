import { useQuery } from '@tanstack/react-query'
import { membersApi, queryKeys } from '@/api'
import { DateField, PageHeader, SelectField, Toolbar } from '@/components/ui'
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, toOptions } from '@/constants/enums'
import { useListParams } from '@/hooks/useListParams'
import { AuditLogList } from '../components/AuditLogList'

const DEFAULTS = { userId: '', action: '', entityType: '', from: '', to: '' }

/**
 * Nhật ký thao tác của tổ chức (docs/api/audit.md) — ai đã làm gì, với đối tượng nào, lúc nào. Chỉ chủ trọ.
 * Gồm cả các lần xem / in / xuất số giấy tờ đầy đủ. Nhật ký giữ 5 năm.
 */
export default function AuditLogsPage() {
  const { params, set } = useListParams(DEFAULTS)
  const members = useQuery({
    queryKey: queryKeys.members.list({ includeRemoved: true }),
    queryFn: ({ signal }) => membersApi.list({ includeRemoved: true }, { signal }),
  })
  const invalidRange = params.from && params.to && params.from > params.to
  const filter = {
    userId: params.userId || undefined,
    action: params.action || undefined,
    entityType: params.entityType || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  }

  return (
    <>
      <PageHeader title="Nhật ký thao tác" description="Mọi thao tác tạo / sửa / xóa dữ liệu và các lần xem, in, xuất số giấy tờ đầy đủ — của bạn và của phó quản lý. Giữ 5 năm." />
      <Toolbar>
        <SelectField
          aria-label="Người làm"
          placeholder="Mọi người"
          options={(members.data ?? []).map((m) => ({ value: m.id, label: m.fullName }))}
          value={params.userId}
          onChange={(e) => set({ userId: e.target.value })}
        />
        <SelectField aria-label="Thao tác" placeholder="Mọi thao tác" options={toOptions(AUDIT_ACTION_LABELS)} value={params.action} onChange={(e) => set({ action: e.target.value })} />
        <SelectField aria-label="Đối tượng" placeholder="Mọi đối tượng" options={toOptions(AUDIT_ENTITY_LABELS)} value={params.entityType} onChange={(e) => set({ entityType: e.target.value })} />
        <DateField aria-label="Từ ngày" value={params.from} onChange={(e) => set({ from: e.target.value })} />
        <DateField aria-label="Đến ngày" error={invalidRange ? 'Phải từ ngày bắt đầu trở đi.' : null} value={params.to} onChange={(e) => set({ to: e.target.value })} />
      </Toolbar>
      {!invalidRange && <AuditLogList filter={filter} />}
    </>
  )
}
