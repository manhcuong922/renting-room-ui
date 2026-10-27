import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { invoicesApi, queryKeys } from '@/api'
import { DataTable, EmptyState, Pagination, QueryView, Section } from '@/components/ui'
import { formatBillingMonth, formatDate, formatMoney } from '@/lib/format'
import { InvoiceAmountCell } from './InvoiceAmountCell'
import { InvoiceBadges } from './InvoiceBadges'

const PAGE_SIZE = 10

const columns = [
  {
    key: 'month',
    header: 'Kỳ',
    primary: true,
    cell: (i) => (
      <Link to={`/invoices/${i.id}`}>
        <strong>{formatBillingMonth(i.billingMonth)}</strong>
      </Link>
    ),
  },
  { key: 'no', header: 'Số phiếu', cell: (i) => i.invoiceNo ?? 'Chưa cấp số' },
  { key: 'contract', header: 'Hợp đồng', hideOnMobile: true, cell: (i) => `${i.contractNo} — ${i.representativeName}` },
  { key: 'total', header: 'Tổng hóa đơn', align: 'right', cell: (i) => <InvoiceAmountCell summary={i} /> },
  { key: 'outstanding', header: 'Còn nợ', align: 'right', cell: (i) => (i.status === 'Finalized' ? formatMoney(i.outstanding) : '—') },
  { key: 'due', header: 'Hạn', hideOnMobile: true, cell: (i) => (i.dueDate ? formatDate(i.dueDate) : '—') },
  { key: 'status', header: 'Trạng thái', cell: (i) => <InvoiceBadges summary={i} /> },
]

/** Phiếu tiền phòng của phòng — mọi hợp đồng, mới nhất trước (invoices.md: GET /rooms/{id}/invoices, phân trang). */
export function RoomInvoicesSection({ roomId }) {
  const [page, setPage] = useState(1)
  const params = { page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: queryKeys.invoices.byRoom(roomId, params),
    queryFn: ({ signal }) => invoicesApi.listByRoom(roomId, params, { signal }),
    placeholderData: keepPreviousData,
  })
  return (
    <Section title="Phiếu tiền phòng">
      <div>
        <QueryView query={query} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="Phòng chưa có phiếu tiền phòng" />} errorTitle="Không tải được phiếu của phòng">
          {(data) => (
            <>
              <DataTable columns={columns} rows={data.items} rowHref={(i) => `/invoices/${i.id}`} caption="Phiếu của phòng" stale={query.isPlaceholderData} />
              <Pagination {...data} disabled={query.isPlaceholderData} onPageChange={setPage} />
            </>
          )}
        </QueryView>
      </div>
    </Section>
  )
}
