import { http } from '@/lib/http/client'

// docs/api/contracts.md
export const contractsApi = {
  list: (query, options) => http.get('/contracts', { ...options, query }),
  get: (id, options) => http.get(`/contracts/${id}`, options),
  create: (body, { idempotencyKey }) => http.post('/contracts', body, { idempotencyKey }),
  update: (id, body) => http.put(`/contracts/${id}`, body),
  updateNote: (id, note) => http.put(`/contracts/${id}/note`, { note }),
  cancel: (id, body) => http.post(`/contracts/${id}/cancel`, body),
  activate: (id, body, { idempotencyKey } = {}) => http.post(`/contracts/${id}/activate`, body, { idempotencyKey }),
  billingPeriods: (id, query, options) => http.get(`/contracts/${id}/billing-periods`, { ...options, query }),

  addOccupant: (id, body) => http.post(`/contracts/${id}/occupants`, body),
  endOccupancy: (id, occupantId, body) => http.post(`/contracts/${id}/occupants/${occupantId}/end`, body),
  changeRent: (id, body) => http.post(`/contracts/${id}/rent-terms`, body),
  extend: (id, body) => http.post(`/contracts/${id}/extend`, body),
  giveNotice: (id, body) => http.post(`/contracts/${id}/notice`, body),

  startLiquidation: (id, body) => http.post(`/contracts/${id}/liquidation/start`, body),
  cancelLiquidation: (id) => http.post(`/contracts/${id}/liquidation/cancel`),
  completeLiquidation: (id) => http.post(`/contracts/${id}/liquidation/complete`),

  addAsset: (id, body) => http.post(`/contracts/${id}/assets`, body),
  updateAsset: (id, assetId, body) => http.put(`/contracts/${id}/assets/${assetId}`, body),
  deleteAsset: (id, assetId) => http.delete(`/contracts/${id}/assets/${assetId}`),
  returnAsset: (id, assetId, body) => http.post(`/contracts/${id}/assets/${assetId}/return`, body),

  registerVehicle: (id, body) => http.post(`/contracts/${id}/vehicles`, body),
  endVehicle: (id, vehicleId, body) => http.post(`/contracts/${id}/vehicles/${vehicleId}/end`, body),
}
