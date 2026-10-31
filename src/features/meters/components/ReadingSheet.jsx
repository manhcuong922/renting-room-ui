import { RefreshCw, Save } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { invoicesApi, metersApi, queryKeys } from '@/api'
import { Badge, Button, DataTable, DateField, NumberField, useToast } from '@/components/ui'
import { useAction, useInvalidate } from '@/hooks/useAction'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { formatDate, formatDayMonth, todayVN } from '@/lib/format'
import { getErrorMessage } from '@/lib/http/ApiError'
import { dateError, formatReading, validReading, VIEW_FILTERS } from '../meterRules'
import styles from '../pages/MeterReadingSheetPage.module.css'

const rowKey = (r) => `${r.meterId}|${r.contractId}|${r.closingPeriodStart}`

/** MT-BR-08: sản lượng gấp ≥ 3 lần trung bình 3 kỳ trước VÀ tăng ≥ 50, hoặc = 0 khi phòng có người ở — chỉ nhắc, không chặn. */
function unusual(consumption, recentAverage) {
  if (consumption === null) return null
  if (consumption === 0) return 'Sản lượng bằng 0 dù phòng có người ở — kiểm lại chỉ số.'
  if (recentAverage !== null && consumption >= 3 * recentAverage && consumption - recentAverage >= 50)
    return `Cao bất thường: trung bình 3 kỳ trước là ${formatReading(recentAverage)}.`
  return null
}

/**
 * Bảng nhập chỉ số cuối kỳ của một khu theo tháng thu (docs/api/meters.md#lưới-ghi-chỉ-số-hằng-tháng) — dùng ở trang Ghi chỉ số và trong hộp thoại
 * "Bỏ qua các kỳ chưa lập" (nhập chỉ số chốt kỳ cuối khoảng).
 */
export function ReadingSheet({ propertyId, billingMonth, rows: allRows, view }) {
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

