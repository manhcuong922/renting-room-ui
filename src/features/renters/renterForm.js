// Người thuê ⇄ form + kiểm tra phía client (docs/api/renters.md#tạo-hồ-sơ).
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

export function toRenterForm(r) {
  if (!r) return EMPTY_RENTER
  return Object.fromEntries(Object.keys(EMPTY_RENTER).map((k) => [k, k === 'idNumber' ? '' : (r[k] ?? EMPTY_RENTER[k])]))
}

export function toRenterBody(v) {
  const body = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, typeof val === 'string' && val.trim() === '' ? null : typeof val === 'string' ? val.trim() : val]))
  body.idNumber = body.idNumber ? body.idNumber.replace(/\s+/g, '') : null
  body.nationality = body.nationality ? body.nationality.toUpperCase() : 'VN'
  return body
}

const ID_PATTERNS = {
  CitizenId: [/^\d{12}$/, 'CCCD / số định danh gồm 12 chữ số.'],
  LegacyId: [/^\d{9}$/, 'CMND gồm 9 chữ số.'],
  Passport: [/^[A-Za-z0-9]{6,20}$/, 'Hộ chiếu 6–20 ký tự chữ/số.'],
}

/** existing: hồ sơ đang sửa (null khi tạo). Sửa mà để trống số giấy tờ = giữ số cũ (trừ khi đổi loại). */
export function makeRenterValidate(existing) {
  return (v) => {
    const number = v.idNumber.replace(/\s+/g, '')
    const keepsOld = existing && existing.idType === v.idType && !number
    const [pattern, message] = ID_PATTERNS[v.idType] ?? [/.+/, '']
    const today = new Date().toISOString().slice(0, 10)
    return {
      fullName: !v.fullName.trim() ? 'Nhập họ tên.' : null,
      dateOfBirth: !v.dateOfBirth ? 'Nhập ngày sinh.' : v.dateOfBirth > today || v.dateOfBirth < '1900-01-01' ? 'Ngày sinh không hợp lệ.' : null,
      gender: !v.gender ? 'Chọn giới tính.' : null,
      idNumber: keepsOld ? null : !number ? 'Nhập số giấy tờ.' : !pattern.test(number) ? message : null,
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
