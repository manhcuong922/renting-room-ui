import { useQueries } from '@tanstack/react-query'
import { Building, CalendarClock, ChevronRight, CircleAlert, DoorOpen, FilePlus, FileText, Gauge, HandCoins, Send, TriangleAlert, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { contractsApi, invoicesApi, propertiesApi, queryKeys, roomsApi } from '@/api'
import { Card, PageHeader, Spinner } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { cx } from '@/lib/cx'
import { formatMoney } from '@/lib/format'
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
    to: '/contracts?quick=expiring',
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
    to: '/contracts?quick=overdue',
    tone: 'danger',
    query: () => {
      const params = { ...COUNT, overdue: true }
      return { queryKey: queryKeys.contracts.list(params), queryFn: ({ signal }) => contractsApi.list(params, { signal }) }
    },
  },
  // Công nợ trên mọi phiếu đã chốt (invoices.md#số-tổng-hợp) — cùng một lời gọi cho cả hai thẻ.
  {
    id: 'outstanding',
    label: 'Còn nợ (phiếu đã chốt)',
    icon: HandCoins,
    to: '/invoices?allMonths=1&unpaidOnly=1',
    tone: 'warning',
    query: () => ({ queryKey: queryKeys.invoices.totals({}), queryFn: ({ signal }) => invoicesApi.totals({}, { signal }) }),
    value: (data) => formatMoney(data.outstandingAmount),
  },
  {
    id: 'overdueDebt',
    label: 'Nợ quá hạn thanh toán',
    icon: CircleAlert,
    to: '/rooms?overdue=1',
    tone: 'danger',
    query: () => ({ queryKey: queryKeys.invoices.totals({}), queryFn: ({ signal }) => invoicesApi.totals({}, { signal }) }),
    value: (data) => formatMoney(data.overdueAmount),
  },
]

// Việc đang tồn đọng — chỉ hiện dòng có số > 0, bấm vào là tới đúng danh sách cần xử lý.
const TODOS = [
  {
    id: 'draftInvoices',
    icon: FileText,
    label: (n) => `${n} phiếu nháp chờ chốt`,
    hint: 'Kiểm tra rồi chốt để gửi người thuê',
    to: '/invoices?allMonths=1&status=Draft',
    query: () => {
      const params = { ...COUNT, status: 'Draft' }
      return { queryKey: queryKeys.invoices.list(params), queryFn: ({ signal }) => invoicesApi.list(params, { signal }) }
    },
  },
  {
    id: 'resend',
    icon: Send,
    label: (n) => `${n} phiếu cần gửi lại`,
    hint: 'Phiếu đã sửa sau khi gửi — gửi bản mới cho người thuê',
    to: '/invoices?allMonths=1&needsResend=1',
    query: () => {
      const params = { ...COUNT, needsResend: true }
      return { queryKey: queryKeys.invoices.list(params), queryFn: ({ signal }) => invoicesApi.list(params, { signal }) }
    },
  },
  {
    id: 'liquidating',
    icon: Wallet,
    label: (n) => `${n} hợp đồng đang thanh lý`,
    hint: 'Lập hóa đơn trả phòng, xử lý cọc rồi hoàn tất',
    to: '/contracts?status=Liquidating',
    query: () => {
      const params = { ...COUNT, status: 'Liquidating' }
      return { queryKey: queryKeys.contracts.list(params), queryFn: ({ signal }) => contractsApi.list(params, { signal }) }
    },
  },
  {
    id: 'draftContracts',
    icon: FilePlus,
    label: (n) => `${n} hợp đồng nháp chưa kích hoạt`,
    hint: 'Kích hoạt khi bàn giao phòng, hoặc xóa nếu không thuê nữa',
    to: '/contracts?status=Draft',
    query: () => {
      const params = { ...COUNT, status: 'Draft' }
      return { queryKey: queryKeys.contracts.list(params), queryFn: ({ signal }) => contractsApi.list(params, { signal }) }
    },
  },
]

const SHORTCUTS = [
  { to: '/meter-readings', icon: Gauge, label: 'Ghi chỉ số' },
  { to: '/invoices', icon: FileText, label: 'Phiếu tiền phòng' },
  { to: '/invoices?allMonths=1&unpaidOnly=1', icon: HandCoins, label: 'Thu tiền' },
  { to: '/contracts/new', icon: FilePlus, label: 'Tạo hợp đồng' },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const results = useQueries({ queries: STATS.map((stat) => stat.query()) })
  const todoResults = useQueries({ queries: TODOS.map((todo) => todo.query()) })
  const todos = TODOS.map((todo, i) => ({ ...todo, count: todoResults[i].data?.totalCount ?? 0 })).filter((todo) => todo.count > 0)
  const todosLoading = todoResults.some((r) => r.isPending)

  return (
    <>
      <PageHeader title={`Xin chào, ${user.fullName}`} description={user.organization?.name} />

      <nav aria-label="Lối tắt" className={styles.shortcuts}>
        {SHORTCUTS.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className={styles.shortcut}>
            <Icon size={18} aria-hidden />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <Card className={styles.todoCard}>
        <h2 className={styles.todoTitle}>Cần xử lý</h2>
        {todosLoading ? (
          <Spinner size={18} />
        ) : todos.length === 0 ? (
          <p className={styles.todoEmpty}>Không có việc tồn đọng.</p>
        ) : (
          <ul className={styles.todoList}>
            {todos.map(({ id, icon: Icon, label, hint, to, count }) => (
              <li key={id}>
                <Link to={to} className={styles.todo}>
                  <Icon size={18} aria-hidden className={styles.todoIcon} />
                  <span className={styles.todoText}>
                    <strong>{label(count.toLocaleString('vi-VN'))}</strong>
                    <span>{hint}</span>
                  </span>
                  <ChevronRight size={18} aria-hidden className={styles.todoChevron} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

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
                    {isPending ? <Spinner size={18} /> : isError ? '—' : stat.value ? stat.value(data) : data.totalCount.toLocaleString('vi-VN')}
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
