import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { queryKeys, roomsApi } from '@/api'
import { Badge, EmptyState, QueryView, Section, StatusBadge } from '@/components/ui'
import { CONTRACT_STATUS, TENANCY_ROLE_LABELS } from '@/constants/enums'
import { formatDate } from '@/lib/format'
import styles from './TenancyHistorySection.module.css'

const range = (from, to) => `${formatDate(from)} → ${to ? formatDate(to) : 'nay'}`

/**
 * Lịch sử thuê của phòng (rooms.md#lịch-sử-thuê-của-phòng), mới nhất trước. Mỗi phần tử là MỘT LẦN một hợp đồng ở phòng —
 * hợp đồng chuyển sang phòng khác rồi quay lại thì có 2 lần. Người đứng tên theo thời điểm nằm ở `representatives[]`.
 * Chỉ có họ tên; hồ sơ đã xóa theo yêu cầu hiện "Đã ẩn danh #…".
 */
export function TenancyHistorySection({ roomId }) {
  const query = useQuery({
    queryKey: queryKeys.rooms.tenancyHistory(roomId),
    queryFn: ({ signal }) => roomsApi.tenancyHistory(roomId, { signal }),
  })
  return (
    <Section title="Lịch sử thuê của phòng" description="Ai đã ở phòng này, đứng tên từ ngày nào tới ngày nào.">
      <QueryView query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Phòng chưa từng có người thuê" />} errorTitle="Không tải được lịch sử thuê">
        {(stays) => (
          <ol className={styles.list}>
            {stays.map((stay) => (
              <li key={`${stay.contractId}-${stay.fromDate}`} className={styles.stay}>
                <div className={styles.head}>
                  <Link to={`/contracts/${stay.contractId}`}>
                    <strong>{stay.contractNo}</strong>
                  </Link>
                  <span>{range(stay.fromDate, stay.toDate)}</span>
                  {stay.isCurrent && <Badge tone="success">Đang ở</Badge>}
                  <StatusBadge map={CONTRACT_STATUS} value={stay.status} />
                </div>
                <div className={styles.row}>
                  <span className={styles.label}>Đứng tên</span>
                  <span>
                    {(stay.representatives?.length ? stay.representatives : [{ renterId: null, fullName: stay.representativeName, fromDate: stay.fromDate, toDate: stay.toDate }]).map((r, index) => (
                      <span key={`${r.renterId}-${r.fromDate}`}>
                        {index > 0 && ' · '}
                        {r.renterId ? <Link to={`/renters/${r.renterId}`}>{r.fullName}</Link> : r.fullName} ({range(r.fromDate, r.toDate)})
                      </span>
                    ))}
                  </span>
                </div>
                <div className={styles.row}>
                  <span className={styles.label}>Người ở</span>
                  <span>
                    {stay.occupants.length === 0
                      ? '—'
                      : stay.occupants.map((o, index) => (
                          <span key={`${o.renterId}-${o.fromDate}`}>
                            {index > 0 && ' · '}
                            <Link to={`/renters/${o.renterId}`}>{o.fullName}</Link>
                            {o.role !== 'Resident' && ` (${TENANCY_ROLE_LABELS[o.role] ?? o.role})`} {range(o.fromDate, o.toDate)}
                          </span>
                        ))}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </QueryView>
    </Section>
  )
}
