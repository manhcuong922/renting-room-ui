import { http } from '@/lib/http/client'

// docs/api/properties.md
export const propertiesApi = {
  list: (query, options) => http.get('/properties', { ...options, query }),
  get: (id, options) => http.get(`/properties/${id}`, options),
  create: (body, { idempotencyKey }) => http.post('/properties', body, { idempotencyKey }),
  update: (id, body) => http.put(`/properties/${id}`, body),
  archive: (id) => http.post(`/properties/${id}/archive`),
  restore: (id) => http.post(`/properties/${id}/restore`),
  updateLessor: (id, body) => http.put(`/properties/${id}/lessor`, body),
  revealLessorIdNumber: (id) => http.post(`/properties/${id}/lessor/reveal-id-number`),
  updateBankAccount: (id, body) => http.put(`/properties/${id}/bank-account`, body),
  updateHouseRules: (id, body) => http.put(`/properties/${id}/house-rules`, body),
}
