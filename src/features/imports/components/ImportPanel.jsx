import { Download, Save, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { importsApi, queryKeys } from '@/api'
import { Alert, Badge, Button, DateField, MoneyField, NumberField, Section, SelectField, StatusBadge, TextField, useToast } from '@/components/ui'
import { IMPORT_OUTCOME } from '@/constants/enums'
import { useInvalidate } from '@/hooks/useAction'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { saveBlob } from '@/lib/download'
import { getErrorMessage } from '@/lib/http/ApiError'
import styles from './ImportPanel.module.css'

const MAX_FILE_BYTES = 2 * 1024 * 1024
const STALE_AFTER_MS = 15 * 60 * 1000
const normalizeKey = (key) => String(key ?? '').trim().toUpperCase()

function Cell({ column, value, onChange, label }) {
  const common = { 'aria-label': label }
  if (column.type === 'number') return <NumberField {...common} decimals={column.decimals ?? 0} value={value ?? null} onChange={onChange} />
  if (column.type === 'money') return <MoneyField {...common} suffix="" value={value ?? null} onChange={onChange} />
  if (column.type === 'date') return <DateField {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
  if (column.type === 'select') return <SelectField {...common} placeholder="—" options={column.options} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
  if (column.type === 'list')
    return (
      <TextField
        {...common}
        value={(value ?? []).join(', ')}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
      />
    )
  return <TextField {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
}

/**
 * Một luồng nhập Excel (docs/api/imports.md): tải mẫu → chọn file → server đọc và kiểm từng dòng (không lưu, không giữ gì) →
 * sửa thẳng ô sai trên lưới → Lưu: server kiểm lại toàn bộ, lưu phần hợp lệ, trả kết quả từng đơn vị (dòng / phòng).
 * Đơn vị đã lưu được bỏ khỏi lưới; đơn vị lỗi giữ lại để sửa tiếp.
 *
 *  columns: [{ key, label, type: 'text' | 'number' | 'money' | 'date' | 'select' | 'list', options?, decimals?, width? }]
 *  unitKeyOf(row): khóa đơn vị lưu của một dòng (mã phòng) — khớp `units[].key` / `rooms[].roomCode` của server.
 */
export function ImportPanel({ property, kind, title, description, columns, unitKeyOf, unitLabel }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const fileRef = useRef(null)
  const [rows, setRows] = useState(null) // [{ row, errors, warnings }]
  const [fileErrors, setFileErrors] = useState([])
  const [unitIssues, setUnitIssues] = useState({}) // khóa đơn vị → { errors, warnings, outcome }
  const [previewedAt, setPreviewedAt] = useState(0)
  const [busy, setBusy] = useState(null) // 'template' | 'preview' | 'save'
  const [savedCount, setSavedCount] = useState(0)

  const reset = () => {
    setRows(null)
    setFileErrors([])
    setUnitIssues({})
    setSavedCount(0)
    idem.reset()
  }

  const downloadTemplate = async () => {
    setBusy('template')
    try {
      const { blob, filename } = await importsApi.template(property.id, kind)
      saveBlob(blob, filename ?? `mau-nhap-${kind}.xlsx`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const preview = async (file) => {
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) return toast.error('Chỉ nhận file Excel .xlsx theo mẫu.')
    if (file.size > MAX_FILE_BYTES) return toast.error('File lớn hơn 2 MB — tách bớt dòng (tối đa 500 dòng mỗi lần).')
    setBusy('preview')
    try {
      const result = await importsApi.preview(property.id, kind, file)
      reset()
      setRows(result.rows)
      setFileErrors(result.fileErrors ?? [])
      // Người thuê: lỗi / cảnh báo của cả phòng nằm ở `rooms[]`.
      setUnitIssues(Object.fromEntries((result.rooms ?? []).map((room) => [normalizeKey(room.roomCode), { errors: room.errors, warnings: room.warnings }])))
      setPreviewedAt(Date.now())
      const bad = result.rows.filter((r) => r.errors.length).length
      if (bad || result.fileErrors?.length) toast.warning(`Đã đọc ${result.rows.length} dòng — ${bad} dòng có lỗi, sửa ngay trên lưới hoặc sửa file rồi tải lại.`)
      else toast.success(`Đã đọc ${result.rows.length} dòng — chưa lưu gì, kiểm tra rồi bấm Lưu.`)
    } catch (error) {
      // Lỗi cả file: IMPORT_FILE_INVALID / TOO_LARGE / TEMPLATE_MISMATCH / TOO_MANY_ROWS; 429: quá 10 lần xem trước / phút.
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const edit = (index, key, value) => {
    setRows((current) => current.map((item, i) => (i === index ? { ...item, row: { ...item.row, [key]: value } } : item)))
  }

  const save = async () => {
    if (Date.now() - previewedAt > STALE_AFTER_MS) toast.warning('Đã quá 15 phút từ lần xem trước — dữ liệu trên hệ thống có thể đã đổi; server sẽ kiểm lại khi lưu.')
    const payload = rows.map((item) => item.row)
    setBusy('save')
    try {
      const result = await importsApi.save(property.id, kind, payload, { idempotencyKey: idem.keyFor(payload) })
      idem.reset()
      const byKey = Object.fromEntries(result.units.map((unit) => [normalizeKey(unit.key), unit]))
      // Đơn vị đã lưu: bỏ khỏi lưới (gửi lại sẽ bị bỏ qua, không nhân đôi). Đơn vị lỗi: giữ lại kèm lý do.
      setRows((current) => current.filter((item) => byKey[unitKeyOf(item.row)]?.outcome !== 'Saved').map((item) => ({ ...item, errors: [], warnings: [] })))
      setUnitIssues(Object.fromEntries(result.units.filter((unit) => unit.outcome !== 'Saved').map((unit) => [normalizeKey(unit.key), { errors: unit.errors, warnings: [], outcome: unit.outcome }])))
      setSavedCount((count) => count + result.saved)
      await invalidate(queryKeys.rooms.all, queryKeys.properties.all, queryKeys.renters.all, queryKeys.contracts.all, queryKeys.meters.all)
      if (result.saved > 0) toast.success(`Đã lưu ${result.saved} ${unitLabel}.`)
      if (result.skipped > 0) toast.error(`${result.skipped} ${unitLabel} chưa lưu — xem lý do ở từng dòng, sửa rồi lưu lại.`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const remaining = rows?.length ?? 0

  return (
    <Section
      title={title}
      description={description}
      actions={
        <>
          <Button size="sm" variant="secondary" icon={Download} loading={busy === 'template'} onClick={downloadTemplate}>
            Tải file mẫu
          </Button>
          <Button size="sm" icon={Upload} loading={busy === 'preview'} disabled={busy === 'save'} onClick={() => fileRef.current?.click()}>
            Chọn file để xem trước
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx" className="visually-hidden" tabIndex={-1} aria-hidden onChange={(e) => preview(e.target.files?.[0])} />
        </>
      }
    >
      {fileErrors.length > 0 && (
        <Alert>
          <strong>File có lỗi:</strong> {fileErrors.map((issue) => issue.message).join(' ')}
        </Alert>
      )}
      {rows === null ? (
        <p className={styles.muted}>Tải file mẫu, điền theo các cột, rồi chọn file để xem trước. Xem trước không lưu gì — đóng màn là mất.</p>
      ) : remaining === 0 ? (
        <Alert tone="info">{savedCount > 0 ? `Đã lưu xong ${savedCount} ${unitLabel}. Chọn file khác nếu cần nhập thêm.` : 'File không có dòng dữ liệu nào.'}</Alert>
      ) : (
        <>
          {savedCount > 0 && <Alert tone="info">Đã lưu {savedCount} {unitLabel}; còn {remaining} dòng chưa lưu bên dưới.</Alert>}
          <div className={styles.wrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Dòng</th>
                  {columns.map((column) => (
                    <th key={column.key} scope="col" style={{ minWidth: column.width ?? 130 }}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => {
                  const unit = unitIssues[unitKeyOf(item.row)]
                  const errors = [...item.errors, ...(unit?.errors ?? [])]
                  const warnings = [...item.warnings, ...(unit?.warnings ?? [])]
                  return (
                    <tr key={item.row.rowNumber} className={errors.length ? styles.rowError : warnings.length ? styles.rowWarning : undefined}>
                      <th scope="row" className={styles.rowHead}>
                        {item.row.rowNumber}
                        {unit?.outcome && (
                          <div>
                            <StatusBadge map={IMPORT_OUTCOME} value={unit.outcome} />
                          </div>
                        )}
                        {!unit?.outcome && errors.length === 0 && <Badge tone="success">Hợp lệ</Badge>}
                        {errors.map((issue) => (
                          <div key={`${issue.code}-${issue.column ?? ''}-${issue.message}`} className={styles.error}>
                            {issue.column ? `${issue.column}: ` : ''}
                            {issue.message}
                          </div>
                        ))}
                        {warnings.map((issue) => (
                          <div key={`${issue.code}-${issue.message}`} className={styles.warning}>
                            {issue.message}
                          </div>
                        ))}
                      </th>
                      {columns.map((column) => (
                        <td key={column.key}>
                          <Cell column={column} value={item.row[column.key]} label={`${column.label} dòng ${item.row.rowNumber}`} onChange={(value) => edit(index, column.key, value)} />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.saveBar}>
            <span className={styles.muted}>Bấm Lưu: server kiểm lại toàn bộ rồi lưu phần hợp lệ; dòng lỗi giữ lại để sửa tiếp. Có thể mất vài giây.</span>
            <span className={styles.actions}>
              <Button variant="ghost" onClick={reset} disabled={busy === 'save'}>
                Bỏ file này
              </Button>
              <Button icon={Save} loading={busy === 'save'} onClick={save}>
                Lưu {remaining} dòng
              </Button>
            </span>
          </div>
        </>
      )}
    </Section>
  )
}
