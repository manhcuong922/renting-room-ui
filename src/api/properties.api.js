import { http } from '@/lib/http/client'

// docs/api/properties.md
export const propertiesApi = {
  list: (query, options) => http.get('/properties', { ...options, query }),
  get: (id, options) => http.get(`/properties/${id}`, options),
  create: (body, { idempotencyKey }) => http.post('/properties', body, { idempotencyKey }),
  update: (id, body) => http.put(`/properties/${id}`, body),
  archive: (id) => http.post(`/properties/${id}/archive`),
  restore: (id) => http.post(`/properties/${id}/restore`),
  // Cài đặt kỳ thu của khu — mọi HĐ dùng chung; xem trước kỳ chuyển tiếp trước khi lưu.
  billingPreview: (id, query, options) => http.get(`/properties/${id}/billing/preview`, { ...options, query }),
  updateBilling: (id, body) => http.put(`/properties/${id}/billing`, body),
  // Bên cho thuê riêng của khu (khác chủ trọ). DELETE = quay về thông tin chủ trọ (/org/lessor).
  updateLessor: (id, body) => http.put(`/properties/${id}/lessor`, body),
  clearLessor: (id) => http.delete(`/properties/${id}/lessor`),
  revealLessorIdNumber: (id) => http.post(`/properties/${id}/lessor/reveal-id-number`),
  updateBankAccount: (id, body) => http.put(`/properties/${id}/bank-account`, body),
  updateHouseRules: (id, body) => http.put(`/properties/${id}/house-rules`, body),
}
