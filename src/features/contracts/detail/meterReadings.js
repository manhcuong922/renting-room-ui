// Chỉ số công tơ khi kích hoạt (nhận phòng) và khi trả phòng (chỉ số cuối) — docs/api/contracts.md, meters.md.
export const NUMBER = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

/**
 * Trạng thái ban đầu: mỗi công tơ { mode, value }.
 * - handover: mặc định "Dùng số mới nhất" (value null = latestReading, thường là số cuối của người thuê trước).
 * - final: bắt buộc nhập, trừ khi đã có chỉ số cuối (kind Final) → mặc định giữ số đó.
 */
export function initialReadings(meters, kind) {
  return Object.fromEntries(
    meters.map((m) => {
      const keep = kind === 'handover' ? Boolean(m.latestReading) : m.latestReading?.kind === 'Final'
      return [m.id, { mode: keep ? 'latest' : 'custom', value: null }]
    }),
  )
}

/** Body gửi server: [{ meterId, value }] — value null = dùng số mới nhất / giữ chỉ số cuối đã nhập. */
export function toReadingInputs(meters, readings) {
  return meters.map((m) => ({ meterId: m.id, value: readings[m.id]?.mode === 'custom' ? readings[m.id].value : null }))
}

/** Lỗi phía client: số nhập phải ≥ số mới nhất. Trả { meterId: 'thông báo' }. */
export function validateReadings(meters, readings) {
  const errors = {}
  for (const m of meters) {
    const r = readings[m.id]
    if (r?.mode !== 'custom') continue
    if (r.value === null || r.value === undefined) errors[m.id] = 'Nhập chỉ số.'
    else if (m.latestReading && m.latestReading.kind !== 'Final' && r.value < m.latestReading.value)
      errors[m.id] = `Phải ≥ chỉ số mới nhất (${NUMBER.format(m.latestReading.value)}).`
  }
  return errors
}

/**
 * Lỗi server về chỉ số → { meterId: 'thông báo' } (contracts.md#kích-hoạt-bàn-giao-phòng, #lập-phiếu-quyết-toán):
 * HANDOVER_READING_REQUIRED / FINAL_READING_REQUIRED (meterIds), READING_NOT_MONOTONIC (meterId, previousValue).
 */
export function readingErrorsFromApi(error) {
  const ext = error?.extensions ?? {}
  if (['HANDOVER_READING_REQUIRED', 'FINAL_READING_REQUIRED'].includes(error?.code)) {
    return Object.fromEntries((ext.meterIds ?? []).map((id) => [id, 'Thiếu chỉ số của công tơ này.']))
  }
  if (error?.code === 'READING_NOT_MONOTONIC' && ext.meterId) {
    return { [ext.meterId]: ext.previousValue != null ? `Phải ≥ chỉ số trước (${NUMBER.format(ext.previousValue)}).` : error.detail }
  }
  return {}
}
