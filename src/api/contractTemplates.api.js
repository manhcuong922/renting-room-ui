import { http } from '@/lib/http/client'

// docs/api/contract-templates.md
export const contractTemplatesApi = {
  list: (query, options) => http.get('/contract-templates', { ...options, query }),
  presets: (options) => http.get('/contract-templates/presets', options),
  get: (id, options) => http.get(`/contract-templates/${id}`, options),
  create: (body, { idempotencyKey }) => http.post('/contract-templates', body, { idempotencyKey }),
  update: (id, body) => http.put(`/contract-templates/${id}`, body),
  archive: (id) => http.post(`/contract-templates/${id}/archive`),
  restore: (id) => http.post(`/contract-templates/${id}/restore`),
}
