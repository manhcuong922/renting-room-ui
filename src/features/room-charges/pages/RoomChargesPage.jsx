import { useQuery } from '@tanstack/react-query'
import { CirclePlus } from 'lucide-react'
import { roomChargesApi, queryKeys } from '@/api'
import { Card, DateField, EmptyState, PageHeader, QueryView, SelectField, Toolbar } from '@/components/ui'
import { ROOM_CHARGE_STATUS } from '@/constants/enums'
import { usePropertyOptions } from '@/features/shared/queries'
import { useListParams } from '@/hooks/useListParams'
import { formatMoney } from '@/lib/format'
import { RoomChargeList } from '../components/RoomChargeList'

const DEFAULTS = { propertyId: '', status: '', from: '', to: '' }
const STATUS_OPTIONS = Object.entries(ROOM_CHARGE_STATUS).map(([value, meta]) => ({ value, label: meta.label }))

/**
 * Khoản phát sinh theo khu / khoảng ngày (room-charges.md: GET /room-charges — mảng, mới nhất trước).
 * Tạo khoản mới ở chi tiết phòng (khoản gắn với phòng đang có người thuê).
 */
export default function RoomChargesPage() {
  const { params, set } = useListParams(DEFAULTS)
  const properties = usePropertyOptions()
  const invalidRange = params.from && params.to && params.from > params.to
  const filter = { propertyId: params.propertyId || undefined, status: params.status || undefined, from: params.from || undefined, to: params.to || undefined }
  const query = useQuery({
    queryKey: queryKeys.roomCharges.list(filter),
    queryFn: ({ signal }) => roomChargesApi.list(filter, { signal }),
    enabled: !invalidRange,
  })

  return (
    <>
      <PageHeader title="Khoản phát sinh" description="Phụ thu và khoản bù của các phòng: chờ lên phiếu, trên phiếu nháp, đã vào phiếu. Thêm khoản mới ở chi tiết phòng." />
      <Toolbar>
        <SelectField
          aria-label="Khu trọ"
          placeholder="Mọi khu"
          options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          value={params.propertyId}
          onChange={(e) => set({ propertyId: e.target.value })}
        />
        <SelectField aria-label="Trạng thái" placeholder="Mọi trạng thái" options={STATUS_OPTIONS} value={params.status} onChange={(e) => set({ status: e.target.value })} />
        <DateField aria-label="Phát sinh từ ngày" value={params.from} onChange={(e) => set({ from: e.target.value })} />
        <DateField aria-label="Đến ngày" error={invalidRange ? 'Phải từ ngày bắt đầu trở đi.' : null} value={params.to} onChange={(e) => set({ to: e.target.value })} />
      </Toolbar>

      {!invalidRange && (
        <QueryView
          query={query}
          isEmpty={(d) => d.length === 0}
          empty={
            <Card>
              <EmptyState icon={CirclePlus} title="Không có khoản phát sinh" description="Chưa có khoản nào khớp bộ lọc. Vào chi tiết phòng để thêm phụ thu hoặc khoản bù." />
            </Card>
          }
          errorTitle="Không tải được khoản phát sinh"
        >
          {(charges) => {
            const open = charges.filter((c) => !c.isSettled && (c.status === 'Pending' || c.status === 'OnDraft'))
            const sum = (kind) => open.filter((c) => c.kind === kind).reduce((total, c) => total + c.amount, 0)
            return (
              <>
                <p style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  {charges.length} khoản · chưa lên phiếu đã chốt: phụ thu {formatMoney(sum('Surcharge'))}, bù {formatMoney(sum('Credit'))}
                </p>
                <RoomChargeList charges={charges} showRoom />
              </>
            )
          }}
        </QueryView>
      )}
    </>
  )
}
