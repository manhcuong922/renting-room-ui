import { http } from '@/lib/http/client'

// docs/api/fees.md — khoản thu & bảng giá của khu.
export const feesApi = {
  // → mảng khoản thu kèm giá đang hiệu lực (currentPrice) và toàn bộ bảng giá (prices, mới nhất trước).
  listByProperty: (propertyId, query, options) => http.get(`/properties/${propertyId}/fee-types`, { ...options, query }),
  get: (id, options) => http.get(`/fee-types/${id}`, options),
  // → 201 { id, warnings }
  create: (propertyId, body, { idempotencyKey }) => http.post(`/properties/${propertyId}/fee-types`, body, { idempotencyKey }),
  // Sửa tên / đơn vị / tự gắn / thứ tự (không đổi nhóm, cách tính) — kèm version → 200 khoản thu.
  update: (id, body) => http.put(`/fee-types/${id}`, body),
  archive: (id) => http.post(`/fee-types/${id}/archive`),
  restore: (id) => http.post(`/fee-types/${id}/restore`),
  // Một giá { effectiveFrom, unitPrice, note } hoặc theo bậc { effectiveFrom, tiers: [{ upTo, price }] } → 201 { id, warnings }
  addPrice: (id, body) => http.post(`/fee-types/${id}/prices`, body),
  deletePrice: (id, priceId) => http.delete(`/fee-types/${id}/prices/${priceId}`),
  // → 200 { copied, skipped: [tên] }
  copyFrom: (targetPropertyId, sourcePropertyId, body) =>
    http.post(`/properties/${targetPropertyId}/fee-types/copy-from/${sourcePropertyId}`, body),
  // Phòng của khu đang dùng / chưa dùng dịch vụ (mảng). contractId null = phòng trống.
  usage: (id, options) => http.get(`/fee-types/${id}/usage`, options),
  // { action: 'Add' | 'Remove', contractIds, quantity, unitPriceOverride } → 200 kết quả từng hợp đồng.
  changeUsage: (id, body) => http.post(`/fee-types/${id}/usage`, body),
}
