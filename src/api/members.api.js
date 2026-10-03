import { http } from '@/lib/http/client'

// docs/api/members.md — xem: mọi thành viên; thao tác: chỉ OrgOwner
export const membersApi = {
  list: (query, options) => http.get('/org/members', { ...options, query }),
  get: (id, options) => http.get(`/org/members/${id}`, options),
  create: (body, { idempotencyKey }) => http.post('/org/members', body, { idempotencyKey }),
  update: (id, body) => http.put(`/org/members/${id}`, body),
  lock: (id) => http.post(`/org/members/${id}/lock`),
  unlock: (id) => http.post(`/org/members/${id}/unlock`),
  remove: (id) => http.post(`/org/members/${id}/remove`),
  resetPassword: (id) => http.post(`/org/members/${id}/reset-password`),
}
