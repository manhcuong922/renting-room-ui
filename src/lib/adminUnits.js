// Danh mục đơn vị hành chính 2 cấp (tỉnh / thành phố → xã / phường / đặc khu) — file tĩnh src/data/vnAdminUnits.json,
// lấy từ Cục Thống kê (danhmuchanhchinh.nso.gov.vn). Backend chưa có API danh mục; địa chỉ vẫn lưu dạng chữ,
// khu trọ gửi kèm mã (provinceCode, communeCode — docs/api/properties.md#tạo-khu).
import { foldText } from './text'

let unitsPromise = null

/** Tải danh mục khi cần (chunk riêng ~200 KB, không nằm trong gói chính). → { asOf, provinces: [{ code, name, type, communes: [{ code, name, type }] }] } */
export function loadAdminUnits() {
  unitsPromise ??= import('@/data/vnAdminUnits.json').then((module) => module.default)
  // Tải lỗi (mất mạng) → lần sau thử lại thay vì giữ mãi promise hỏng.
  unitsPromise.catch(() => {
    unitsPromise = null
  })
  return unitsPromise
}

// "Thành phố Hà Nội" ≡ "Hà Nội" ≡ "ha noi"; "Phường Cầu Giấy" ≡ "Cầu Giấy".
const UNIT_PREFIX = /^(thanh pho|tinh|phuong|xa|dac khu|tp\.?)\s+/
const unitKey = (name) => foldText(name ?? '').replace(UNIT_PREFIX, '')

/** Tìm đơn vị theo mã, không có mã thì theo tên (dữ liệu nhập tay trước khi có danh mục). */
export function findUnit(units, code, name) {
  if (!units) return null
  if (code) {
    const byCode = units.find((unit) => unit.code === code)
    if (byCode) return byCode
  }
  const key = unitKey(name)
  return key ? (units.find((unit) => unitKey(unit.name) === key) ?? null) : null
}

export const toUnitOptions = (units) => (units ?? []).map((unit) => ({ value: unit.code, label: unit.name }))
