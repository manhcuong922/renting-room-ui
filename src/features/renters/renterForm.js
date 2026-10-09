// Người thuê ⇄ form + kiểm tra phía client (docs/api/renters.md#tạo-hồ-sơ).
import { todayVN } from '@/lib/format'

export const EMPTY_RENTER = {
  fullName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  email: '',
  nationality: 'VN',
  idType: 'CitizenId',
  idNumber: '',
  idIssueDate: '',
  idIssuePlace: '',
  permanentAddress: '',
  occupation: '',
  workplace: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  note: '',
}

// idType '' = chưa có giấy tờ (chỉ trẻ dưới 14 tuổi) — gửi idType/idNumber = null.
export const NO_ID_DOCUMENT = ''
export const ID_REQUIRED_FROM_AGE = 14

export function toRenterForm(r) {
  if (!r) return EMPTY_RENTER
  const form = Object.fromEntries(Object.keys(EMPTY_RENTER).map((k) => [k, k === 'idNumber' ? '' : (r[k] ?? EMPTY_RENTER[k])]))
  form.idType = r.idType ?? NO_ID_DOCUMENT
  return form
}

export function toRenterBody(v) {
  const body = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, typeof val === 'string' && val.trim() === '' ? null : typeof val === 'string' ? val.trim() : val]))
  body.idNumber = body.idNumber ? body.idNumber.replace(/\s+/g, '') : null
  body.nationality = body.nationality ? body.nationality.toUpperCase() : 'VN'
  if (!body.idType) Object.assign(body, { idType: null, idNumber: null, idIssueDate: null, idIssuePlace: null })
  return body
}

const ID_PATTERNS = {
  CitizenId: [/^\d{12}$/, 'CCCD / số định danh gồm 12 chữ số.'],
  LegacyId: [/^\d{9}$/, 'CMND gồm 9 chữ số.'],
  Passport: [/^[A-Za-z0-9]{6,20}$/, 'Hộ chiếu 6–20 ký tự chữ/số.'],
}

function validateIdNumber(v, existing) {
  if (!v.idType) return null
  const number = v.idNumber.replace(/\s+/g, '')
  const keepsOld = existing?.idNumberMasked && existing.idType === v.idType && !number
  if (keepsOld) return null
  if (!number) return 'Nhập số giấy tờ.'
  const [pattern, message] = ID_PATTERNS[v.idType] ?? [/.+/, '']
  return pattern.test(number) ? null : message
}

/**
 * existing: hồ sơ đang sửa (null khi tạo). Sửa mà để trống số giấy tờ = giữ số cũ (trừ khi đổi loại).
 * Từ 14 tuổi bắt buộc có giấy tờ; dưới 14 tuổi được để "Chưa có giấy tờ" (docs/api/renters.md#tạo-hồ-sơ).
 */
export function makeRenterValidate(existing) {
  return (v) => {
    const today = todayVN()
    const age = ageAt(v.dateOfBirth, today)
    const needsId = !v.idType && (age === null || age >= ID_REQUIRED_FROM_AGE)
    return {
      fullName: !v.fullName.trim() ? 'Nhập họ tên.' : null,
      dateOfBirth: !v.dateOfBirth ? 'Nhập ngày sinh.' : v.dateOfBirth > today || v.dateOfBirth < '1900-01-01' ? 'Ngày sinh không hợp lệ.' : null,
      gender: !v.gender ? 'Chọn giới tính.' : null,
      idType: needsId ? `Từ ${ID_REQUIRED_FROM_AGE} tuổi phải có giấy tờ.` : null,
      idNumber: validateIdNumber(v, existing),
      idIssueDate: v.idIssueDate && (v.idIssueDate > today || (v.dateOfBirth && v.idIssueDate < v.dateOfBirth)) ? 'Ngày cấp phải sau ngày sinh, không ở tương lai.' : null,
      nationality: v.nationality && !/^[A-Za-z]{2}$/.test(v.nationality.trim()) ? 'Mã quốc gia 2 chữ (VN, KR…).' : null,
    }
  }
}

/** Tuổi tròn tại một ngày (yyyy-MM-dd). */
export function ageAt(dateOfBirth, atDate) {
  if (!dateOfBirth || !atDate) return null
  const [by, bm, bd] = dateOfBirth.split('-').map(Number)
  const [ay, am, ad] = atDate.split('-').map(Number)
  return ay - by - (am < bm || (am === bm && ad < bd) ? 1 : 0)
}
