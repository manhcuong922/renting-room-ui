// Khoản thu của hợp đồng (docs/api/contracts.md#khoản-thu-của-hợp-đồng, fees.md).
import { formatMoney } from '@/lib/format'

/** Số gói của dịch vụ theo số lượng: > 0, ≤ 100, tối đa 2 số lẻ (ContractFeeRules.IsValidQuantity). */
export function validFeeQuantity(q) {
  return q > 0 && q <= 100 && Math.round(q * 100) === q * 100
}

/** "3.500 đ/kWh" · "giá bậc từ 1.984 đ/kWh" · null khi chưa có giá. */
export function formatFeePrice(price, unit) {
  if (!price) return null
  if (price.tiers?.length) return `giá bậc từ ${formatMoney(price.tiers[0].price)}/${unit}`
  return `${formatMoney(price.unitPrice)}/${unit}`
}

/** Khoản "tự gắn" của khu → giá trị mặc định của contract.fees (dịch vụ PerUnit lấy số gói mặc định). */
export function autoAttachedFees(feeTypes) {
  return feeTypes
    .filter((f) => f.group === 'Service' && f.autoAttach && !f.isArchived)
    .map((f) => ({ feeTypeId: f.id, quantity: f.chargeBasis === 'PerUnit' ? (f.defaultQuantity ?? 1) : null, unitPriceOverride: null }))
}
