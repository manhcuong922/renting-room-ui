// Chuyển đổi dữ liệu khu ⇄ form + kiểm tra phía client (docs/api/properties.md#tạo-khu).
// Cài đặt kỳ thu (`billing`) của khu — mọi HĐ của khu dùng chung. Chỉ gửi khi TẠO khu; sau đó đổi qua PUT /properties/{id}/billing.
export const DEFAULT_BILLING = { anchorDay: 1, chargeMode: 'Postpaid', paymentDueDays: 5, prorationMode: 'Daily', noticeDays: 30, roundInvoiceTotal: true }
export const ANCHOR_DAY_MAX = 28

export function toPropertyForm(p) {
  return {
    code: p?.code ?? '',
    name: p?.name ?? '',
    address: {
      streetAddress: p?.address?.streetAddress ?? '',
      communeName: p?.address?.communeName ?? '',
      provinceName: p?.address?.provinceName ?? '',
    },
    description: p?.description ?? '',
    evnCustomerCode: p?.evnCustomerCode ?? '',
    land: {
      parcelNo: p?.land?.parcelNo ?? '',
      mapSheetNo: p?.land?.mapSheetNo ?? '',
      ownershipCertificateNo: p?.land?.ownershipCertificateNo ?? '',
    },
    billing: { ...DEFAULT_BILLING },
  }
}

const str = (v) => (v?.trim() ? v.trim() : null)

export function toPropertyBody(v) {
  const land = { parcelNo: str(v.land.parcelNo), mapSheetNo: str(v.land.mapSheetNo), ownershipCertificateNo: str(v.land.ownershipCertificateNo) }
  return {
    name: v.name.trim(),
    address: {
      streetAddress: v.address.streetAddress.trim(),
      communeName: v.address.communeName.trim(),
      provinceName: v.address.provinceName.trim(),
      communeCode: null,
      provinceCode: null,
    },
    description: str(v.description),
    evnCustomerCode: str(v.evnCustomerCode),
    land: Object.values(land).some(Boolean) ? land : null,
  }
}

export const inRange = (n, min, max) => Number.isInteger(n) && n >= min && n <= max

/** Lỗi phía client của bộ cài đặt kỳ thu; `prefix` = 'billing.' trong form tạo khu. */
export function validateBilling(b, prefix = '') {
  return {
    [`${prefix}anchorDay`]: !inRange(b.anchorDay, 1, ANCHOR_DAY_MAX) ? `Từ 1 đến ${ANCHOR_DAY_MAX}.` : null,
    [`${prefix}paymentDueDays`]: !inRange(b.paymentDueDays, 0, 60) ? 'Từ 0 đến 60.' : null,
    [`${prefix}noticeDays`]: !inRange(b.noticeDays, 0, 180) ? 'Từ 0 đến 180.' : null,
  }
}

export function validateProperty(v, { creating }) {
  return {
    code: creating && !/^[A-Za-z0-9._/-]{1,32}$/.test(v.code.trim()) ? 'Mã ≤ 32 ký tự: chữ, số, . _ / -' : null,
    name: !v.name.trim() ? 'Nhập tên khu.' : null,
    'address.streetAddress': !v.address.streetAddress.trim() ? 'Nhập số nhà, ngõ, đường.' : null,
    'address.communeName': !v.address.communeName.trim() ? 'Nhập xã/phường.' : null,
    'address.provinceName': !v.address.provinceName.trim() ? 'Nhập tỉnh/thành phố.' : null,
    ...(creating ? validateBilling(v.billing, 'billing.') : {}),
  }
}
