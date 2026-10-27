// Quy tắc chỉ số công tơ phía client (docs/api/meters.md; giới hạn khớp MeterMapping của backend).
import { addDays, todayVN } from '@/lib/format'

export const MAX_READING = 99_999_999.99

/** Chỉ số hợp lệ: 0 – 99.999.999,99, tối đa 2 số lẻ. */
export const validReading = (value) => typeof value === 'number' && value >= 0 && value <= MAX_READING && Math.round(value * 100) === value * 100

export const readingError = (value, { required = true } = {}) =>
  value === null || value === undefined ? (required ? 'Nhập chỉ số.' : null) : validReading(value) ? null : 'Chỉ số từ 0, tối đa 2 số lẻ.'

/** Ngày ghi / lắp / thay / tháo: không quá hôm nay + 1. */
export const dateError = (date) => (!date ? 'Chọn ngày.' : date > addDays(todayVN(), 1) ? 'Ngày không được quá ngày mai.' : null)

// Chỉ hủy tay được chỉ số cuối kỳ và kiểm tra; các loại khác gắn với vòng đời công tơ / hợp đồng (422 READING_NOT_VOIDABLE).
export const VOIDABLE_KINDS = new Set(['Periodic', 'Adhoc'])

const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
export const formatReading = (value) => (value === null || value === undefined ? '—' : numberFormatter.format(value))

/** Câu gợi ý khi 422 READING_NOT_MONOTONIC: body có previousValue / nextValue. */
export function monotonicMessage(error) {
  const { previousValue, nextValue } = error.extensions ?? {}
  const parts = []
  if (previousValue !== null && previousValue !== undefined) parts.push(`không nhỏ hơn ${formatReading(previousValue)}`)
  if (nextValue !== null && nextValue !== undefined) parts.push(`không lớn hơn ${formatReading(nextValue)}`)
  return parts.length ? `Chỉ số phải ${parts.join(' và ')}.` : (error.detail ?? 'Chỉ số không hợp lệ so với các chỉ số đã ghi.')
}
