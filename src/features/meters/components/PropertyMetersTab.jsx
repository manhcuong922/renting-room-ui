import { useQuery } from '@tanstack/react-query'
import { Gauge } from 'lucide-react'
import { useState } from 'react'
import { metersApi, queryKeys } from '@/api'
import { Alert, Button, Card, DataTable, DateField, EmptyState, FormGrid, NumberField, QueryView, RadioGroup, SelectField, TextField, useToast } from '@/components/ui'
import { usePropertyFees } from '@/features/shared/queries'
import { useInvalidate } from '@/hooks/useAction'
import { blankToNull } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { addMonths, formatDate, todayVN } from '@/lib/format'
import { getErrorMessage } from '@/lib/http/ApiError'
import { dateError, formatReading, readingError } from '../meterRules'
import styles from './PropertyMetersTab.module.css'

const MODES = [
  { value: 'install', label: 'Lắp hàng loạt' },
  { value: 'replace', label: 'Thay hàng loạt' },
  { value: 'vacant', label: 'Sản lượng phòng trống' },
]
const AFFECTED = [queryKeys.rooms.all, queryKeys.meters.all, queryKeys.invoices.all]

const roomLabel = (row) => `${row.roomCode}${row.floor ? ` · tầng ${row.floor}` : ''}`

/** Lỗi theo dòng của lệnh hàng loạt: 422 … kèm rowErrors[{ index, code, message }] — index theo thứ tự dòng đã gửi. */
function rowErrorsByKey(error, sentKeys) {
  const rowErrors = error.extensions?.rowErrors
  if (!Array.isArray(rowErrors)) return null
  return Object.fromEntries(rowErrors.map((e) => [sentKeys[e.index], e.message ?? e.code]))
}

function FeePicker({ fees, value, onChange }) {
  return (
    <SelectField
      label="Khoản thu"
      required
      placeholder="Chọn điện / nước…"
      options={fees.map((f) => ({ value: f.id, label: `${f.name} (${f.unit})` }))}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// ---------------------------------------------------------------- Lắp hàng loạt

function BulkInstallGrid({ property, fee, rows }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const [installedDate, setInstalledDate] = useState(todayVN())
  const [inputs, setInputs] = useState({}) // roomId → { serialNo, initialValue }
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const set = (roomId, changes) => {
    setInputs((current) => ({ ...current, [roomId]: { serialNo: '', initialValue: null, ...current[roomId], ...changes } }))
    setErrors((current) => (current[roomId] ? { ...current, [roomId]: undefined } : current))
  }
  const filled = rows.filter((r) => inputs[r.roomId]?.initialValue !== null && inputs[r.roomId]?.initialValue !== undefined)
  const dateProblem = dateError(installedDate)

  const save = async () => {
    const invalid = Object.fromEntries(filled.map((r) => [r.roomId, readingError(inputs[r.roomId].initialValue)]).filter(([, message]) => message))
    setErrors(invalid)
    if (dateProblem || Object.keys(invalid).length) return toast.error('Vui lòng kiểm tra các ô được đánh dấu.')
    const body = {
      feeTypeId: fee.id,
      installedDate,
      rows: filled.map((r) => ({ roomId: r.roomId, serialNo: blankToNull(inputs[r.roomId].serialNo), initialValue: inputs[r.roomId].initialValue })),
    }
    setBusy(true)
    try {
      const result = await metersApi.bulkInstall(property.id, body, { idempotencyKey: idem.keyFor(body) })
      idem.reset()
      setInputs({})
      await invalidate(...AFFECTED)
      toast.success(`Đã lắp ${result.installed} công tơ ${fee.name}.`)
    } catch (error) {
      const byRoom = rowErrorsByKey(error, body.rows.map((r) => r.roomId))
      if (byRoom) setErrors(byRoom)
      toast.error(byRoom ? 'Có dòng không hợp lệ — chưa lắp công tơ nào. Sửa các dòng tô đỏ rồi lưu lại.' : getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'room', header: 'Phòng', primary: true, cell: (r) => <strong>{roomLabel(r)}</strong> },
    {
      key: 'serial',
      header: 'Số serial',
      cell: (r) => <TextField aria-label={`Serial phòng ${r.roomCode}`} maxLength={50} value={inputs[r.roomId]?.serialNo ?? ''} onChange={(e) => set(r.roomId, { serialNo: e.target.value })} />,
    },
    {
      key: 'initial',
      header: `Chỉ số ban đầu (${fee.unit})`,
      cell: (r) => (
        <NumberField
          aria-label={`Chỉ số ban đầu phòng ${r.roomCode}`}
          decimals={2}
          placeholder="Bỏ trống = không lắp"
          error={errors[r.roomId]}
          value={inputs[r.roomId]?.initialValue ?? null}
          onChange={(initialValue) => set(r.roomId, { initialValue })}
        />
      ),
    },
  ]

  return (
    <div className={styles.stack}>
      <FormGrid cols={3}>
        <DateField label="Ngày lắp (chung)" required error={dateProblem} value={installedDate} onChange={(e) => setInstalledDate(e.target.value)} />
      </FormGrid>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.roomId} rowClassName={(r) => (errors[r.roomId] ? styles.rowError : undefined)} caption="Phòng chưa có công tơ" />
      <div className={styles.saveBar}>
        <span className={styles.muted}>Nhập chỉ số ban đầu cho phòng cần lắp; phòng bỏ trống được bỏ qua. Lỗi một dòng thì không lưu dòng nào.</span>
        <Button onClick={save} loading={busy} disabled={filled.length === 0}>
          Lắp {filled.length} công tơ
        </Button>
      </div>
    </div>
  )
}

function BulkInstall({ property, fee }) {
  const query = useQuery({
    queryKey: queryKeys.meters.installSheet(property.id, fee.id),
    queryFn: ({ signal }) => metersApi.installSheet(property.id, { feeTypeId: fee.id }, { signal }),
  })
  return (
    <QueryView
      query={query}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon={Gauge} title={`Phòng nào cũng đã có công tơ ${fee.name}`} description="Muốn đổi công tơ, dùng Thay hàng loạt hoặc Thay ở từng phòng." />}
      errorTitle="Không tải được danh sách phòng"
    >
      {(rows) => <BulkInstallGrid key={query.dataUpdatedAt} property={property} fee={fee} rows={rows} />}
    </QueryView>
  )
}

// ---------------------------------------------------------------- Thay hàng loạt

function BulkReplaceGrid({ property, fee, rows }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const [replacedOn, setReplacedOn] = useState(todayVN())
  const [note, setNote] = useState('')
  const [inputs, setInputs] = useState({}) // meterId → { oldFinalValue, newSerialNo, newInitialValue }
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const set = (meterId, changes) => {
    setInputs((current) => ({ ...current, [meterId]: { oldFinalValue: null, newSerialNo: '', newInitialValue: null, ...current[meterId], ...changes } }))
    setErrors((current) => (current[meterId] ? { ...current, [meterId]: undefined } : current))
  }
  const filled = rows.filter((r) => inputs[r.meterId]?.oldFinalValue !== null && inputs[r.meterId]?.oldFinalValue !== undefined)
  const dateProblem = dateError(replacedOn)

  const save = async () => {
    const invalid = {}
    for (const r of filled) {
      const input = inputs[r.meterId]
      const message =
        readingError(input.oldFinalValue) ??
        (r.lastValue !== null && input.oldFinalValue < r.lastValue ? `Số cuối không nhỏ hơn chỉ số gần nhất ${formatReading(r.lastValue)}.` : null) ??
        readingError(input.newInitialValue, { required: false })
      if (message) invalid[r.meterId] = message
    }
    setErrors(invalid)
    if (dateProblem || Object.keys(invalid).length) return toast.error('Vui lòng kiểm tra các ô được đánh dấu.')
    const body = {
      feeTypeId: fee.id,
      replacedOn,
      note: blankToNull(note),
      rows: filled.map((r) => ({
        meterId: r.meterId,
        oldFinalValue: inputs[r.meterId].oldFinalValue,
        newSerialNo: blankToNull(inputs[r.meterId].newSerialNo),
        newInitialValue: inputs[r.meterId].newInitialValue,
      })),
    }
    setBusy(true)
    try {
      const result = await metersApi.bulkReplace(property.id, body, { idempotencyKey: idem.keyFor(body) })
      idem.reset()
      setInputs({})
      await invalidate(...AFFECTED)
      toast.success(`Đã thay ${result.replaced} công tơ ${fee.name}. Phiếu nháp của các phòng này cần tính lại.`)
    } catch (error) {
      const byMeter = rowErrorsByKey(error, body.rows.map((r) => r.meterId))
      if (byMeter) setErrors(byMeter)
      toast.error(byMeter ? 'Có dòng không hợp lệ — chưa thay công tơ nào. Sửa các dòng tô đỏ rồi lưu lại.' : getErrorMessage(error))
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
          <strong>{roomLabel(r)}</strong>
          {errors[r.meterId] && <div className={styles.rowMessage}>{errors[r.meterId]}</div>}
        </div>
      ),
    },
    {
      key: 'old',
      header: 'Công tơ cũ',
      cell: (r) => `${r.serialNo ?? 'Không serial'} · ${r.lastValue !== null ? `${formatReading(r.lastValue)} (${formatDate(r.lastDate)})` : 'chưa có chỉ số'}`,
    },
    {
      key: 'final',
      header: `Số cuối công tơ cũ (${fee.unit})`,
      cell: (r) => (
        <NumberField
          aria-label={`Số cuối công tơ cũ phòng ${r.roomCode}`}
          decimals={2}
          placeholder="Bỏ trống = không thay"
          value={inputs[r.meterId]?.oldFinalValue ?? null}
          onChange={(oldFinalValue) => set(r.meterId, { oldFinalValue })}
        />
      ),
    },
    {
      key: 'serial',
      header: 'Serial mới',
      cell: (r) => (
        <TextField aria-label={`Serial mới phòng ${r.roomCode}`} maxLength={50} value={inputs[r.meterId]?.newSerialNo ?? ''} onChange={(e) => set(r.meterId, { newSerialNo: e.target.value })} />
      ),
    },
    {
      key: 'initial',
      header: 'Chỉ số đầu mới',
      cell: (r) => (
        <NumberField
          aria-label={`Chỉ số đầu công tơ mới phòng ${r.roomCode}`}
          decimals={2}
          placeholder="0"
          value={inputs[r.meterId]?.newInitialValue ?? null}
          onChange={(newInitialValue) => set(r.meterId, { newInitialValue })}
        />
      ),
    },
  ]

  return (
    <div className={styles.stack}>
      <FormGrid cols={3}>
        <DateField label="Ngày thay (chung)" required error={dateProblem} value={replacedOn} onChange={(e) => setReplacedOn(e.target.value)} />
        <TextField label="Ghi chú" maxLength={300} placeholder="VD Điện lực thay đồng loạt" className="span-full" value={note} onChange={(e) => setNote(e.target.value)} />
      </FormGrid>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.meterId} rowClassName={(r) => (errors[r.meterId] ? styles.rowError : undefined)} caption="Công tơ đang hoạt động" />
      <div className={styles.saveBar}>
        <span className={styles.muted}>Chỉ nhập phòng có thay. Kỳ có thay, phiếu tự cộng công tơ cũ và mới. Lỗi một dòng thì không lưu dòng nào.</span>
        <Button onClick={save} loading={busy} disabled={filled.length === 0}>
          Thay {filled.length} công tơ
        </Button>
      </div>
    </div>
  )
}

function BulkReplace({ property, fee }) {
  const query = useQuery({
    queryKey: queryKeys.meters.replaceSheet(property.id, fee.id),
    queryFn: ({ signal }) => metersApi.replaceSheet(property.id, { feeTypeId: fee.id }, { signal }),
  })
  return (
    <QueryView
      query={query}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon={Gauge} title={`Chưa phòng nào có công tơ ${fee.name} đang hoạt động`} />}
      errorTitle="Không tải được danh sách công tơ"
    >
      {(rows) => <BulkReplaceGrid key={query.dataUpdatedAt} property={property} fee={fee} rows={rows} />}
    </QueryView>
  )
}

// ---------------------------------------------------------------- Sản lượng phòng trống

const VACANT_COLUMNS = [
  { key: 'room', header: 'Phòng', primary: true, cell: (r) => <strong>{r.roomCode}</strong> },
  { key: 'fee', header: 'Khoản', cell: (r) => `${r.feeTypeName}${r.serialNo ? ` · ${r.serialNo}` : ''}` },
  { key: 'from', header: 'Từ', cell: (r) => `${formatReading(r.fromValue)} (${formatDate(r.fromDate)})` },
  { key: 'to', header: 'Đến (nhận phòng)', cell: (r) => `${formatReading(r.toValue)} (${formatDate(r.toDate)})` },
  { key: 'quantity', header: 'Sản lượng', align: 'right', cell: (r) => `${formatReading(r.quantity)} ${r.unit}` },
]

function VacantUsage({ property }) {
  const today = todayVN()
  const [range, setRange] = useState({ from: addMonths(today, -12), to: today })
  const invalidRange = range.from && range.to && range.from > range.to
  const params = { from: range.from || undefined, to: range.to || undefined }
  const query = useQuery({
    queryKey: queryKeys.meters.vacantUsage(property.id, params),
    queryFn: ({ signal }) => metersApi.vacantUsage(property.id, params, { signal }),
    enabled: !invalidRange,
  })

  return (
    <div className={styles.stack}>
      <Alert tone="info">
        Điện nước công tơ chạy lúc phòng không có người thuê (sửa chữa, thử phòng) — không nằm trên phiếu của ai. Dùng để đối chiếu hóa đơn điện nước cả
        khu: tổng trên các phiếu + phần này ≈ số nhà cung cấp tính.
      </Alert>
      <FormGrid cols={3}>
        <DateField label="Nhận phòng từ ngày" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        <DateField label="Đến ngày" error={invalidRange ? 'Phải từ ngày bắt đầu trở đi.' : null} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
      </FormGrid>
      {!invalidRange && (
        <QueryView
          query={query}
          isEmpty={(d) => d.rows.length === 0}
          empty={<EmptyState icon={Gauge} title="Không có sản lượng phòng trống trong khoảng này" />}
          errorTitle="Không tải được sản lượng phòng trống"
        >
          {(data) => (
            <>
              <div className={styles.totals}>
                {data.totals.map((t) => (
                  <div key={t.feeTypeId} className={styles.total}>
                    <span className={styles.muted}>{t.feeTypeName}</span>
                    <strong>
                      {formatReading(t.quantity)} {t.unit}
                    </strong>
                  </div>
                ))}
              </div>
              <DataTable columns={VACANT_COLUMNS} rows={data.rows} rowKey={(r) => `${r.meterId}-${r.toDate}-${r.toValue}`} caption="Sản lượng phòng trống" />
            </>
          )}
        </QueryView>
      )}
    </div>
  )
}

/**
 * Tab Công tơ của khu (docs/api/meters.md): lắp hàng loạt · thay hàng loạt (VD điện lực thay cả khu) · sản lượng phòng trống.
 * Công tơ của từng phòng: xem ở chi tiết phòng.
 */
export function PropertyMetersTab({ property }) {
  const [mode, setMode] = useState('install')
  const [feeTypeId, setFeeTypeId] = useState('')
  const fees = usePropertyFees(property.id)
  const metered = (fees.data ?? []).filter((f) => f.group === 'Metered')
  // Khu thường chỉ có Điện + Nước: chọn sẵn khoản đầu tiên.
  const fee = metered.find((f) => f.id === feeTypeId) ?? metered[0]
  const readOnly = property.isArchived

  return (
    <Card>
      <div className={styles.stack}>
        <RadioGroup options={readOnly ? MODES.filter((m) => m.value === 'vacant') : MODES} value={readOnly ? 'vacant' : mode} onChange={setMode} />
        {readOnly || mode === 'vacant' ? (
          <VacantUsage property={property} />
        ) : (
          <QueryView query={fees} loading="page" errorTitle="Không tải được khoản thu">
            {() =>
              fee ? (
                <>
                  <FormGrid cols={3}>
                    <FeePicker fees={metered} value={fee.id} onChange={setFeeTypeId} />
                  </FormGrid>
                  {mode === 'install' ? <BulkInstall key={fee.id} property={property} fee={fee} /> : <BulkReplace key={fee.id} property={property} fee={fee} />}
                </>
              ) : (
                <EmptyState icon={Gauge} title="Khu chưa có khoản điện nước theo công tơ" description="Thêm ở tab Khoản thu trước." />
              )
            }
          </QueryView>
        )}
      </div>
    </Card>
  )
}
