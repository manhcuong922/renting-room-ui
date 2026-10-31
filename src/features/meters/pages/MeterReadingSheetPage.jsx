import { useQuery } from '@tanstack/react-query'
import { Gauge } from 'lucide-react'
import { useMemo } from 'react'
import { metersApi, queryKeys } from '@/api'
import { Alert, Card, EmptyState, PageHeader, QueryView, SelectField, TextField, Toolbar } from '@/components/ui'
import { usePropertyFees, usePropertyOptions, usePropertyRooms } from '@/features/shared/queries'
import { useListParams } from '@/hooks/useListParams'
import { currentBillingMonth, formatBillingMonth } from '@/lib/format'
import { ReadingSheet } from '../components/ReadingSheet'
import { VIEW_OPTIONS } from '../meterRules'

const DEFAULTS = { propertyId: '', billingMonth: '', floor: '', feeTypeId: '', view: '' }
/**
 * Lưới ghi chỉ số điện nước cuối kỳ của khu theo tháng thu (docs/api/meters.md#lưới-ghi-chỉ-số-hằng-tháng).
 * Mỗi dòng = (phòng, hợp đồng, công tơ). Khu thu sau: kỳ của tháng; thu trước: kỳ liền trước.
 */
export default function MeterReadingSheetPage() {
  const { params, set } = useListParams(DEFAULTS)
  const properties = usePropertyOptions()
  const propertyId = params.propertyId || properties.data?.[0]?.id || ''
  const billingMonth = params.billingMonth || currentBillingMonth()
  const fees = usePropertyFees(propertyId)
  const metered = (fees.data ?? []).filter((f) => f.group === 'Metered')

  const sheetParams = { billingMonth, floor: params.floor || undefined, feeTypeId: params.feeTypeId || undefined }
  const query = useQuery({
    queryKey: queryKeys.meters.sheet(propertyId, sheetParams),
    queryFn: ({ signal }) => metersApi.readingSheet(propertyId, sheetParams, { signal }),
    enabled: Boolean(propertyId),
  })
  // Ô lọc tầng: các giá trị `floor` của phòng trong khu.
  const rooms = usePropertyRooms(propertyId)
  const floorOptions = useMemo(() => [...new Set((rooms.data ?? []).map((r) => r.floor).filter(Boolean))].sort(), [rooms.data])

  return (
    <>
      <PageHeader title="Ghi chỉ số điện nước" description={`Chỉ số cuối kỳ cho phiếu ${formatBillingMonth(billingMonth).toLowerCase()}.`} />
      <Toolbar>
        <SelectField
          aria-label="Khu trọ"
          options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          value={propertyId}
          onChange={(e) => set({ propertyId: e.target.value, floor: '', feeTypeId: '' })}
        />
        <TextField aria-label="Tháng thu" type="month" value={billingMonth} onChange={(e) => set({ billingMonth: e.target.value, floor: '' })} />
        <SelectField aria-label="Tầng" placeholder="Mọi tầng" options={floorOptions.map((f) => ({ value: f, label: `Tầng ${f}` }))} value={params.floor} onChange={(e) => set({ floor: e.target.value })} />
        <SelectField
          aria-label="Khoản thu"
          placeholder="Điện và nước"
          options={metered.map((f) => ({ value: f.id, label: f.name }))}
          value={params.feeTypeId}
          onChange={(e) => set({ feeTypeId: e.target.value })}
        />
        <SelectField aria-label="Lọc dòng" placeholder="Mọi dòng" options={VIEW_OPTIONS} value={params.view} onChange={(e) => set({ view: e.target.value })} />
      </Toolbar>

      {!propertyId ? (
        <Card>{properties.isPending ? <EmptyState icon={Gauge} title="Đang tải khu trọ…" /> : <EmptyState icon={Gauge} title="Chưa có khu trọ" description="Tạo khu trọ và lắp công tơ cho phòng trước." />}</Card>
      ) : (
        <QueryView
          query={query}
          isEmpty={(d) => d.rows.length === 0}
          empty={
            <Card>
              <EmptyState
                icon={Gauge}
                title="Không có dòng nào cần ghi chỉ số"
                description="Lưới chỉ có phòng đang thuê có công tơ đang hoạt động trong kỳ. Khu thu trước: kỳ đầu của hợp đồng không có dòng."
              />
            </Card>
          }
          errorTitle="Không tải được lưới ghi chỉ số"
        >
          {(data) => (
            <>
              {data.rows.some((r) => r.endsWithFinal) && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <Alert tone="info">Có hợp đồng trả phòng trong kỳ: chỉ số cuối của các phòng đó nhập khi lập hóa đơn trả phòng ở hợp đồng.</Alert>
                </div>
              )}
              <ReadingSheet key={`${propertyId}|${billingMonth}|${params.floor}|${params.feeTypeId}|${params.view}`} propertyId={propertyId} billingMonth={billingMonth} rows={data.rows} view={params.view} />
            </>
          )}
        </QueryView>
      )}
    </>
  )
}
