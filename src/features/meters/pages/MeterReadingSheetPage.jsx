import { useQuery } from '@tanstack/react-query'
import { Gauge, RefreshCw, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { invoicesApi, metersApi, queryKeys } from '@/api'
import { Alert, Badge, Button, Card, DataTable, DateField, EmptyState, NumberField, PageHeader, QueryView, SelectField, TextField, Toolbar, useToast } from '@/components/ui'
import { usePropertyFees, usePropertyOptions, usePropertyRooms } from '@/features/shared/queries'
import { useAction, useInvalidate } from '@/hooks/useAction'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useListParams } from '@/hooks/useListParams'
import { currentBillingMonth, formatBillingMonth, formatDate, formatDayMonth, todayVN } from '@/lib/format'
import { getErrorMessage } from '@/lib/http/ApiError'
import { dateError, formatReading, validReading } from '../meterRules'
import styles from './MeterReadingSheetPage.module.css'

const DEFAULTS = { propertyId: '', billingMonth: '', floor: '', feeTypeId: '', view: '' }
// Lọc phía client (meters.md — lưới có `invoice`): Chưa nhập · Chưa có hóa đơn · Cần tính lại · Đã chốt.
const VIEW_FILTERS = {
  noReading: { label: 'Chưa nhập', test: (r) => !r.current },
  noInvoice: { label: 'Chưa có hóa đơn', test: (r) => !r.invoice },
  stale: { label: 'Cần tính lại', test: (r) => r.invoice?.isStale },
  finalized: { label: 'Đã chốt', test: (r) => r.invoice?.status === 'Finalized' },
}
const VIEW_OPTIONS = Object.entries(VIEW_FILTERS).map(([value, f]) => ({ value, label: f.label }))
const rowKey = (r) => `${r.meterId}|${r.contractId}|${r.closingPeriodStart}`

/** MT-BR-08: sản lượng gấp ≥ 3 lần trung bình 3 kỳ trước VÀ tăng ≥ 50, hoặc = 0 khi phòng có người ở — chỉ nhắc, không chặn. */
function unusual(consumption, recentAverage) {
  if (consumption === null) return null
  if (consumption === 0) return 'Sản lượng bằng 0 dù phòng có người ở — kiểm lại chỉ số.'
  if (recentAverage !== null && consumption >= 3 * recentAverage && consumption - recentAverage >= 50)
    return `Cao bất thường: trung bình 3 kỳ trước là ${formatReading(recentAverage)}.`
  return null
}

function Sheet({ propertyId, billingMonth, rows: allRows, view }) {
  const rows = view ? allRows.filter(VIEW_FILTERS[view].test) : allRows
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const [values, setValues] = useState({}) // key → số người dùng nhập (chưa lưu)
  const [readingDate, setReadingDate] = useState(todayVN())
  const [rowErrors, setRowErrors] = useState({})
  const [rowWarnings, setRowWarnings] = useState({})
  const [busy, setBusy] = useState(false)

  const valueOf = (row) => (rowKey(row) in values ? values[rowKey(row)] : (row.current?.value ?? null))
  // Dòng cần gửi: ô có số, khác số đã lưu, chưa bị phiếu đã chốt khóa.
  const changed = rows.filter((row) => {
    if (row.locked || !(rowKey(row) in values)) return false
    const value = values[rowKey(row)]
    return value !== null && value !== (row.current?.value ?? null)
  })
  const hasNewRows = changed.some((row) => !row.current)
  const dateProblem = hasNewRows ? dateError(readingDate) : null

  const recalculate = useAction({
    mutationFn: () => invoicesApi.recalculate({ propertyId, billingMonth, staleOnly: true, keepManualEdits: true }),
    invalidate: [queryKeys.invoices.all],
    success: (result) => `Đã tính lại ${result.recalculated} phiếu nháp${result.withIssues ? ` — ${result.withIssues} phiếu còn vấn đề` : ''}.`,
  })

  const save = async () => {
    const invalid = {}
    for (const row of changed) {
      const value = values[rowKey(row)]
      if (!validReading(value)) invalid[rowKey(row)] = 'Chỉ số từ 0, tối đa 2 số lẻ.'
      else if (row.previous && value < row.previous.value) invalid[rowKey(row)] = `Không nhỏ hơn chỉ số cũ ${formatReading(row.previous.value)}.`
    }
    setRowErrors(invalid)
    if (dateProblem || Object.keys(invalid).length) return toast.error('Vui lòng kiểm tra các ô được đánh dấu.')

    const body = {
      readings: changed.map((row) => ({
        meterId: row.meterId,
        contractId: row.contractId,
        closingPeriodStart: row.closingPeriodStart,
        // Dòng đã có số: server chỉ sửa giá trị, giữ ngày ghi cũ.
        readingDate: row.current?.readingDate ?? readingDate,
        value: values[rowKey(row)],
      })),
    }
    const keys = changed.map(rowKey)
    setBusy(true)
    try {
      const result = await metersApi.saveReadings(propertyId, body, { idempotencyKey: idem.keyFor(body) })
      idem.reset()
      setValues({})
      // Cảnh báo không chặn: số đã lưu, nhắc kiểm tra ngày ghi (có thể chọn nhầm tháng).
      const warnings = Object.fromEntries((result.warnings ?? []).map((w) => [keys[w.index], w.message]))
      setRowWarnings(warnings)
      await invalidate(queryKeys.meters.all, queryKeys.rooms.all, queryKeys.invoices.all)
      toast.success(`Đã lưu ${result.saved} chỉ số.`)
      if (Object.keys(warnings).length) toast.warning(`${Object.keys(warnings).length} dòng có ngày ghi lệch xa ngày cuối kỳ — xem ghi chú ở từng dòng.`, { duration: 10_000 })
    } catch (error) {
      const serverRows = error.extensions?.rowErrors
      if (Array.isArray(serverRows)) {
        setRowErrors(Object.fromEntries(serverRows.map((e) => [keys[e.index], e.message ?? e.code])))
        toast.error('Có dòng không hợp lệ — chưa lưu dòng nào. Sửa các dòng tô đỏ rồi lưu lại.')
      } else toast.error(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      key: 'room',
      header: 'Phòng',
      primary: true,
      cell: (r) => (
        <div>
          <Link to={`/rooms/${r.roomId}`}>
            <strong>{r.roomCode}</strong>
          </Link>
          <div className={styles.sub}>{r.representativeName}</div>
          {r.moveOutDate && <Badge tone="orange">Trả phòng {formatDayMonth(r.moveOutDate)}</Badge>}
        </div>
      ),
    },
    {
      key: 'meter',
      header: 'Công tơ',
      cell: (r) => (
        <div>
          {r.feeTypeName}
          {r.serialNo && <span className={styles.sub}> · {r.serialNo}</span>}
          <div className={styles.sub}>
            Kỳ {formatDate(r.usageStart)} – {formatDate(r.usageEnd)}
          </div>
        </div>
      ),
    },
    {
      key: 'previous',
      header: 'Chỉ số cũ',
      align: 'right',
      cell: (r) =>
        r.previous ? (
          <div>
            {formatReading(r.previous.value)}
            <div className={styles.sub}>{formatDate(r.previous.readingDate)}</div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'current',
      header: 'Chỉ số mới',
      cell: (r) => {
        const key = rowKey(r)
        return (
          <div className={styles.inputCell}>
            <NumberField
              aria-label={`Chỉ số mới ${r.feeTypeName} phòng ${r.roomCode}`}
              decimals={2}
              suffix={r.unit}
              disabled={r.locked}
              error={rowErrors[key]}
              value={valueOf(r)}
              onChange={(value) => {
                setValues((current) => ({ ...current, [key]: value }))
                setRowErrors((current) => (current[key] ? { ...current, [key]: undefined } : current))
              }}
            />
            {r.locked && <div className={styles.sub}>Đã dùng cho hóa đơn đã chốt — gõ sai thì “Điều chỉnh chỉ số đã chốt” ở lịch sử chỉ số của công tơ.</div>}
            {r.current && !r.locked && <div className={styles.sub}>Ghi ngày {formatDate(r.current.readingDate)}</div>}
          </div>
        )
      },
    },
    {
      key: 'invoice',
      header: 'Hóa đơn',
      hideOnMobile: true,
      cell: (r) =>
        r.invoice ? (
          <Link to={`/invoices/${r.invoice.id}`}>
            {r.invoice.status === 'Finalized' ? 'Đã chốt' : r.invoice.isStale ? 'Nháp — cần tính lại' : 'Nháp'}
          </Link>
        ) : (
          <span className={styles.sub}>Chưa có</span>
        ),
    },
    {
      key: 'consumption',
      header: 'Sản lượng',
      align: 'right',
      cell: (r) => {
        const value = valueOf(r)
        const consumption = value !== null && r.previous ? Math.round((value - r.previous.value) * 100) / 100 : null
        const dirty = rowKey(r) in values
        // Số đã lưu: dùng câu cảnh báo của server; số đang gõ: tự tính theo cùng quy tắc.
        const warning = rowWarnings[rowKey(r)] ?? (dirty ? unusual(consumption, r.recentAverage) : r.usageWarning)
        return (
          <div>
            {consumption === null ? '—' : `${formatReading(consumption)} ${r.unit}`}
            {r.recentAverage !== null && <div className={styles.sub}>TB 3 kỳ: {formatReading(r.recentAverage)}</div>}
            {warning && <div className={styles.warning}>{warning}</div>}
          </div>
        )
      },
    },
  ]

  const missing = allRows.filter((r) => !r.current).length

  return (
    <div className={styles.stack}>
      <div className={styles.summary}>
        <Badge tone={missing ? 'warning' : 'success'}>{missing ? `Còn ${missing} / ${allRows.length} dòng chưa có chỉ số` : `Đã đủ ${allRows.length} chỉ số`}</Badge>
        <div className={styles.dateField}>
          <DateField label="Ngày ghi (cho các số mới)" error={dateProblem} value={readingDate} onChange={(e) => setReadingDate(e.target.value)} />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        rowClassName={(r) => (rowErrors[rowKey(r)] ? styles.rowError : rowWarnings[rowKey(r)] ? styles.rowWarning : undefined)}
        caption="Lưới ghi chỉ số"
      />
      <div className={styles.saveBar}>
        <span className={styles.muted}>Lưu cả lô hoặc không gì: một dòng lỗi thì chưa lưu dòng nào. Lưu xong, hóa đơn nháp dùng các công tơ này tự tính lại.</span>
        <span className={styles.actions}>
          <Button variant="secondary" icon={RefreshCw} loading={recalculate.isPending} onClick={() => recalculate.mutate()}>
            Tính lại phiếu nháp cần tính lại
          </Button>
          <Button icon={Save} loading={busy} disabled={changed.length === 0} onClick={save}>
            Lưu {changed.length} chỉ số
          </Button>
        </span>
      </div>
    </div>
  )
}

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
              <Sheet key={`${propertyId}|${billingMonth}|${params.floor}|${params.feeTypeId}|${params.view}`} propertyId={propertyId} billingMonth={billingMonth} rows={data.rows} view={params.view} />
            </>
          )}
        </QueryView>
      )}
    </>
  )
}
