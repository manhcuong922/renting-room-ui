import { useQueries } from '@tanstack/react-query'
import { Building, CalendarClock, DoorOpen, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { contractsApi, propertiesApi, queryKeys, roomsApi } from '@/api'
import { Card, PageHeader, Spinner } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { cx } from '@/lib/cx'
import styles from './DashboardPage.module.css'

// Chỉ cần totalCount → gọi pageSize=1 cho nhẹ.
const COUNT = { page: 1, pageSize: 1 }

const STATS = [
  {
    id: 'properties',
    label: 'Khu trọ',
    icon: Building,
    to: '/properties',
    query: () => ({ queryKey: queryKeys.properties.list(COUNT), queryFn: ({ signal }) => propertiesApi.list(COUNT, { signal }) }),
  },
  {
    id: 'occupied',
    label: 'Phòng đang thuê',
    icon: DoorOpen,
    to: '/rooms',
    query: () => {
      const params = { ...COUNT, status: 'Occupied' }
      return { queryKey: queryKeys.rooms.list(params), queryFn: ({ signal }) => roomsApi.list(params, { signal }) }
    },
  },
  {
    id: 'expiring',
    label: 'HĐ hết hạn trong 30 ngày',
    icon: CalendarClock,
    to: '/contracts',
    tone: 'warning',
    query: () => {
      const params = { ...COUNT, expiringWithinDays: 30 }
      return { queryKey: queryKeys.contracts.list(params), queryFn: ({ signal }) => contractsApi.list(params, { signal }) }
    },
  },
  {
    id: 'overdue',
    label: 'HĐ quá hạn',
    icon: TriangleAlert,
    to: '/contracts',
    tone: 'danger',
    query: () => {
      const params = { ...COUNT, overdue: true }
      return { queryKey: queryKeys.contracts.list(params), queryFn: ({ signal }) => contractsApi.list(params, { signal }) }
    },
  },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const results = useQueries({ queries: STATS.map((stat) => stat.query()) })

  return (
    <>
      <PageHeader title={`Xin chào, ${user.fullName}`} description={user.organization?.name} />

      <ul className={styles.stats}>
        {STATS.map((stat, index) => {
          const { data, isPending, isError } = results[index]
          const Icon = stat.icon
          return (
            <li key={stat.id}>
              <Link to={stat.to} className={styles.statLink}>
                <Card className={styles.stat}>
                  <span className={cx(styles.statIcon, stat.tone && styles[stat.tone])}>
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className={styles.statLabel}>{stat.label}</span>
                  <span className={styles.statValue}>
                    {isPending ? <Spinner size={18} /> : isError ? '—' : data.totalCount.toLocaleString('vi-VN')}
                  </span>
                </Card>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
