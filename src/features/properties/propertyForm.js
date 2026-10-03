// Chuyển đổi dữ liệu khu ⇄ form + kiểm tra phía client (docs/api/properties.md#tạo-khu).
export const DEFAULT_BILLING = { anchorDay: 1, chargeMode: 'Prepaid', paymentDueDays: 5, prorationMode: 'Daily', noticeDays: 30 }

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
    billingDefaults: { ...DEFAULT_BILLING, ...p?.billingDefaults },
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
    billingDefaults: v.billingDefaults,
  }
}

const inRange = (n, min, max) => Number.isInteger(n) && n >= min && n <= max

export function validateProperty(v, { creating }) {
  const b = v.billingDefaults
  return {
    code: creating && !/^[A-Za-z0-9._/-]{1,32}$/.test(v.code.trim()) ? 'Mã ≤ 32 ký tự: chữ, số, . _ / -' : null,
    name: !v.name.trim() ? 'Nhập tên khu.' : null,
    'address.streetAddress': !v.address.streetAddress.trim() ? 'Nhập số nhà, ngõ, đường.' : null,
    'address.communeName': !v.address.communeName.trim() ? 'Nhập xã/phường.' : null,
    'address.provinceName': !v.address.provinceName.trim() ? 'Nhập tỉnh/thành phố.' : null,
    'billingDefaults.anchorDay': !inRange(b.anchorDay, 1, 31) ? 'Từ 1 đến 31.' : null,
    'billingDefaults.paymentDueDays': !inRange(b.paymentDueDays, 0, 60) ? 'Từ 0 đến 60.' : null,
    'billingDefaults.noticeDays': !inRange(b.noticeDays, 0, 180) ? 'Từ 0 đến 180.' : null,
  }
}
