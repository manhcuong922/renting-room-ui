import { http } from '@/lib/http/client'

// docs/api/contracts.md
export const contractsApi = {
  list: (query, options) => http.get('/contracts', { ...options, query }),
  get: (id, options) => http.get(`/contracts/${id}`, options),
  create: (body, { idempotencyKey }) => http.post('/contracts', body, { idempotencyKey }),
  update: (id, body) => http.put(`/contracts/${id}`, body),
  updateNote: (id, note) => http.put(`/contracts/${id}/note`, { note }),
  setSignedDocument: (id, body) => http.put(`/contracts/${id}/signed-document`, body),
  cancel: (id, body) => http.post(`/contracts/${id}/cancel`, body),
  // body: { handoverReadings: [{ meterId, value | null }] } — chỉ số nhận phòng, null = dùng số mới nhất.
  activate: (id, body, { idempotencyKey } = {}) => http.post(`/contracts/${id}/activate`, body, { idempotencyKey }),
  billingPeriods: (id, query, options) => http.get(`/contracts/${id}/billing-periods`, { ...options, query }),
  // Văn bản .docx để in / ký — nháp có dòng "BẢN NHÁP"; có số giấy tờ đầy đủ (server ghi log).
  document: (id) => http.get(`/contracts/${id}/document`, { responseType: 'blob' }),
  dataReview: (query, options) => http.get('/contracts/data-review', { ...options, query }),

  // Khoản thu của HĐ đang hiệu lực — đổi từ đầu một kỳ thu (effectiveFrom null = kỳ chưa lập phiếu đầu tiên).
  changeFee: (id, feeTypeId, body) => http.put(`/contracts/${id}/fees/${feeTypeId}`, body),
  removeFee: (id, feeTypeId, effectiveFrom) => http.delete(`/contracts/${id}/fees/${feeTypeId}`, { query: { effectiveFrom } }),

  addOccupant: (id, body) => http.post(`/contracts/${id}/occupants`, body),
  endOccupancy: (id, occupantId, body) => http.post(`/contracts/${id}/occupants/${occupantId}/end`, body),
  changeRent: (id, body) => http.post(`/contracts/${id}/rent-terms`, body),
  extend: (id, body) => http.post(`/contracts/${id}/extend`, body),
  holdover: (id, body) => http.post(`/contracts/${id}/holdover`, body),
  // → 201 { id: HĐ nháp mới, warnings }
  reSign: (id, body, { idempotencyKey }) => http.post(`/contracts/${id}/re-sign`, body, { idempotencyKey }),
  giveNotice: (id, body) => http.post(`/contracts/${id}/notice`, body),

  startLiquidation: (id, body) => http.post(`/contracts/${id}/liquidation/start`, body),
  cancelLiquidation: (id) => http.post(`/contracts/${id}/liquidation/cancel`),
  // body: { finalReadings: [{ meterId, value | null }] } → 201 chi tiết phiếu quyết toán nháp.
  createFinalInvoice: (id, body, { idempotencyKey } = {}) => http.post(`/contracts/${id}/final-invoice`, body, { idempotencyKey }),
  // body: { settlement: null | 'CollectAll' | 'WriteOff', method, paidAt, reason }
  completeLiquidation: (id, body) => http.post(`/contracts/${id}/liquidation/complete`, body ?? {}),

  addAsset: (id, body) => http.post(`/contracts/${id}/assets`, body),
  updateAsset: (id, assetId, body) => http.put(`/contracts/${id}/assets/${assetId}`, body),
  deleteAsset: (id, assetId) => http.delete(`/contracts/${id}/assets/${assetId}`),
  returnAsset: (id, assetId, body) => http.post(`/contracts/${id}/assets/${assetId}/return`, body),

  registerVehicle: (id, body) => http.post(`/contracts/${id}/vehicles`, body),
  endVehicle: (id, vehicleId, body) => http.post(`/contracts/${id}/vehicles/${vehicleId}/end`, body),
}
