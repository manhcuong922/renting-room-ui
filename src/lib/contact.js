// Chuẩn hóa SĐT / email đúng như backend (ContactNormalizer) — để biết người dùng có thật sự đổi tên đăng nhập hay không.
const VIETNAM_MOBILE = /^0(3|5|7|8|9)\d{8}$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** "+84 912.345.678", "84912345678", "0912-345-678" → "0912345678"; trống / không hợp lệ → null. */
export function normalizePhone(raw) {
  if (!raw?.trim()) return null
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`
  else if (digits.startsWith('84') && digits.length === 11) digits = `0${digits.slice(2)}`
  return VIETNAM_MOBILE.test(digits) ? digits : null
}

/** Trim + chữ thường; trống / sai dạng → null. */
export function normalizeEmail(raw) {
  if (!raw?.trim()) return null
  const email = raw.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}
