import { Alert, EmptyState, NumberField, RadioGroup, Spinner } from '@/components/ui'
import { READING_KIND_LABELS } from '@/constants/enums'
import { formatDate } from '@/lib/format'
import { NUMBER } from './meterReadings'

function latestText(m) {
  const r = m.latestReading
  if (!r) return 'Chưa có chỉ số'
  return `${NUMBER.format(r.value)} ${m.unit} — ${READING_KIND_LABELS[r.kind] ?? r.kind} ${formatDate(r.readingDate)}`
}

/**
 * Bảng nhập chỉ số cho các công tơ đang hoạt động của phòng.
 * kind = 'handover' (nhận phòng — "Dùng số mới nhất" hoặc số khác ≥ số đó) | 'final' (chỉ số cuối khi trả phòng).
 */
export function MeterReadingsFields({ query, kind, readings, onChange, errors = {} }) {
  if (query.isPending) return <Spinner />
  if (query.isError) return <Alert>Không tải được công tơ của phòng.</Alert>
  const meters = query.data ?? []
  if (meters.length === 0) {
    return <EmptyState title="Phòng chưa có công tơ" description={kind === 'handover' ? 'Không cần nhập chỉ số nhận phòng.' : 'Không cần nhập chỉ số cuối.'} />
  }

  const keepLabel = kind === 'handover' ? 'Dùng số mới nhất' : 'Giữ chỉ số cuối đã nhập'
  return (
    <ul style={{ display: 'grid', gap: 'var(--space-4)', margin: 0, padding: 0, listStyle: 'none' }}>
      {meters.map((m) => {
        const r = readings[m.id] ?? { mode: 'custom', value: null }
        const canKeep = kind === 'handover' ? Boolean(m.latestReading) : m.latestReading?.kind === 'Final'
        const set = (changes) => onChange({ ...readings, [m.id]: { ...r, ...changes } })
        return (
          <li key={m.id} style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <div>
              <strong>
                {m.feeTypeName}
                {m.serialNo ? ` · ${m.serialNo}` : ''}
              </strong>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Mới nhất: {latestText(m)}</div>
            </div>
            {canKeep && (
              <RadioGroup
                options={[
                  { value: 'latest', label: keepLabel },
                  { value: 'custom', label: 'Nhập số khác' },
                ]}
                value={r.mode}
                onChange={(mode) => set({ mode })}
              />
            )}
            {r.mode === 'custom' && (
              <NumberField
                label={kind === 'handover' ? 'Chỉ số nhận phòng' : 'Chỉ số cuối (ngày trả phòng)'}
                required
                decimals={2}
                suffix={m.unit}
                value={r.value}
                onChange={(value) => set({ value })}
                error={errors[m.id]}
              />
            )}
            {r.mode !== 'custom' && errors[m.id] && <Alert>{errors[m.id]}</Alert>}
          </li>
        )
      })}
    </ul>
  )
}
