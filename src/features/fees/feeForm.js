// Khoản thu & bảng giá ⇄ form + kiểm tra phía client (docs/api/fees.md; giới hạn khớp FeeRules của backend).
import { formatMoney, todayVN } from '@/lib/format'

export const MAX_METERED_PRICE = 100_000 // đ / đơn vị — chặn gõ thừa số 0
export const MAX_SERVICE_PRICE = 50_000_000
export const MAX_TIERS = 10
export const MAX_QUANTITY = 100

export const maxPrice = (group) => (group === 'Metered' ? MAX_METERED_PRICE : MAX_SERVICE_PRICE)

const twoDecimals = (n) => Math.round(n * 100) === n * 100
export const validPrice = (price, group) => typeof price === 'number' && price >= 0 && price <= maxPrice(group) && twoDecimals(price)
export const validQuantity = (q) => typeof q === 'number' && q > 0 && q <= MAX_QUANTITY && twoDecimals(q)

// ---------------------------------------------------------------- Bản giá (một giá hoặc theo bậc)

export const emptyPrice = () => ({ effectiveFrom: todayVN(), kind: 'single', unitPrice: null, note: '', tiers: [{ upTo: null, price: null }, { upTo: null, price: null }] })

/** Lỗi phía client của một bản giá; `prefix` = 'initialPrice.' khi nằm trong form tạo khoản thu. */
export function validatePrice(p, group, prefix = '') {
  const errors = { [`${prefix}effectiveFrom`]: !p.effectiveFrom ? 'Chọn ngày hiệu lực.' : null }
  if (p.kind === 'single') {
    errors[`${prefix}unitPrice`] =
      p.unitPrice === null ? 'Nhập đơn giá.'
      : !validPrice(p.unitPrice, group) ? `Đơn giá từ 0 đến ${formatMoney(maxPrice(group))}, tối đa 2 số lẻ.`
      : null
    return errors
  }
  // Theo bậc: mốc lũy kế tăng dần, bậc cuối không có mốc, giá mỗi bậc như giá theo công tơ.
  const last = p.tiers.length - 1
  let message = null
  p.tiers.forEach((tier, index) => {
    if (message) return
    if (!validPrice(tier.price, 'Metered')) message = `Bậc ${index + 1}: giá từ 0 đến ${formatMoney(MAX_METERED_PRICE)}.`
    else if (index < last && !(tier.upTo > 0)) message = `Bậc ${index + 1}: nhập mốc "đến" lớn hơn 0.`
    else if (index > 0 && index < last && tier.upTo <= p.tiers[index - 1].upTo) message = `Bậc ${index + 1}: mốc phải lớn hơn bậc trước.`
  })
  errors[`${prefix}tiers`] = message
  return errors
}

export function toPriceBody(p) {
  const note = p.note?.trim() || null
  if (p.kind === 'single') return { effectiveFrom: p.effectiveFrom, unitPrice: p.unitPrice, note }
  const last = p.tiers.length - 1
  return {
    effectiveFrom: p.effectiveFrom,
    note,
    tiers: p.tiers.map((tier, index) => ({ upTo: index === last ? null : tier.upTo, price: tier.price })),
  }
}

/** "0 – 50: 1.984 đ" … "trên 100: 2.380 đ" — mốc lũy kế. */
export function describeTiers(tiers, unit) {
  let from = 0
  return tiers.map((tier) => {
    const range = tier.upTo === null ? `Trên ${from} ${unit}` : `${from === 0 ? 0 : from + 1} – ${tier.upTo} ${unit}`
    if (tier.upTo !== null) from = tier.upTo
    return `${range}: ${formatMoney(tier.price)}`
  })
}

// ---------------------------------------------------------------- Khoản thu

export function toFeeForm(fee) {
  return {
    name: fee?.name ?? '',
    group: fee?.group ?? 'Service',
    chargeBasis: fee?.chargeBasis ?? 'PerRoom',
    unit: fee?.unit ?? 'phòng',
    autoAttach: fee?.autoAttach ?? false,
    defaultQuantity: fee?.defaultQuantity ?? 1,
    vehicleType: fee?.vehicleType ?? '',
    sortOrder: fee?.sortOrder ?? 100,
    withPrice: !fee,
    initialPrice: emptyPrice(),
  }
}

const isPerUnit = (v) => v.group === 'Service' && v.chargeBasis === 'PerUnit'

export function validateFee(v, { creating }) {
  return {
    name: !v.name.trim() ? 'Nhập tên khoản thu.' : null,
    unit: !v.unit.trim() ? 'Nhập đơn vị.' : null,
    defaultQuantity: isPerUnit(v) && v.defaultQuantity !== null && !validQuantity(v.defaultQuantity) ? `Số gói lớn hơn 0, tối đa ${MAX_QUANTITY}.` : null,
    sortOrder: !Number.isInteger(v.sortOrder) || v.sortOrder < 0 || v.sortOrder > 1000 ? 'Thứ tự từ 0 đến 1000.' : null,
    ...(creating && v.withPrice ? validatePrice(v.initialPrice, v.group, 'initialPrice.') : {}),
  }
}

// Các trường sửa được sau khi tạo (nhóm và cách tính bất biến — FE-BR-02).
function editableFields(v) {
  const service = v.group === 'Service'
  return {
    name: v.name.trim(),
    unit: v.unit.trim(),
    // Điện nước theo công tơ đi theo phòng, không tự gắn vào hợp đồng.
    autoAttach: service ? v.autoAttach : false,
    defaultQuantity: isPerUnit(v) ? v.defaultQuantity : null,
    vehicleType: isPerUnit(v) && v.vehicleType ? v.vehicleType : null,
    sortOrder: v.sortOrder,
  }
}

export function toCreateFeeBody(v) {
  return {
    ...editableFields(v),
    group: v.group,
    chargeBasis: v.group === 'Service' ? v.chargeBasis : null,
    initialPrice: v.withPrice ? toPriceBody({ ...v.initialPrice, kind: v.group === 'Metered' ? v.initialPrice.kind : 'single' }) : null,
  }
}

export const toUpdateFeeBody = (v, version) => ({ ...editableFields(v), version })

/** Đơn vị gợi ý khi đổi nhóm / cách tính trong form tạo. */
export const DEFAULT_UNIT = { Metered: 'kWh', PerRoom: 'phòng', PerOccupant: 'người', PerUnit: 'xe' }
