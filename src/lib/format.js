// Định dạng hiển thị theo conventions.md: tiền VND nguyên, ngày yyyy-MM-dd (giờ VN), thời điểm UTC → +07:00.
const TIME_ZONE = 'Asia/Ho_Chi_Minh'

const moneyFormatter = new Intl.NumberFormat('vi-VN')
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
})

export function formatMoney(value) {
  if (value == null) return '—'
  return `${moneyFormatter.format(value)} đ`
}

// "2026-10-05" → "05/10/2026" (không đổi múi giờ: đây là ngày lịch VN).
export function formatDate(value) {
  if (!value) return '—'
  const [y, m, d] = value.split('-').map(Number)
  return dateFormatter.format(new Date(y, m - 1, d))
}

export function formatDateTime(value) {
  if (!value) return '—'
  return dateTimeFormatter.format(new Date(value))
}

export function initials(fullName) {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  const letters = parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : parts[0].slice(0, 2)
  return letters.toUpperCase()
}

// Ngày hôm nay theo giờ Việt Nam, dạng yyyy-MM-dd (khớp kiểu ngày của API).
const isoDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
export function todayVN() {
  return isoDateFormatter.format(new Date())
}

// Cộng ngày / tháng trên chuỗi yyyy-MM-dd (không phụ thuộc múi giờ máy).
export function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function addMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate()
  const dt = new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay)))
  return dt.toISOString().slice(0, 10)
}

// "2026-10" → "Tháng 10/2026"
export function formatBillingMonth(value) {
  if (!value) return '—'
  const [y, m] = value.split('-')
  return `Tháng ${Number(m)}/${y}`
}
