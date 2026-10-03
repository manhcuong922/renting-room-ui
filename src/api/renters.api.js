import { http } from '@/lib/http/client'

// docs/api/renters.md
export const rentersApi = {
  list: (query, options) => http.get('/renters', { ...options, query }),
  get: (id, options) => http.get(`/renters/${id}`, options),
  create: (body, { idempotencyKey }) => http.post('/renters', body, { idempotencyKey }),
  update: (id, body) => http.put(`/renters/${id}`, body),
  revealIdNumber: (id) => http.post(`/renters/${id}/reveal-id-number`),
}
