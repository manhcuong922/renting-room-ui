import { http } from '@/lib/http/client'

// docs/api/admin.md — chỉ SystemAdmin
export const adminApi = {
  listOrganizations: (query, options) => http.get('/admin/organizations', { ...options, query }),
  getOrganization: (id, options) => http.get(`/admin/organizations/${id}`, options),
  createOrganization: (body, { idempotencyKey }) => http.post('/admin/organizations', body, { idempotencyKey }),
  suspendOrganization: (id, body, options) => http.post(`/admin/organizations/${id}/suspend`, body, options),
  reactivateOrganization: (id, options) => http.post(`/admin/organizations/${id}/reactivate`, undefined, options),

  resetUserPassword: (userId) => http.post(`/admin/users/${userId}/reset-password`),
  lockUser: (userId) => http.post(`/admin/users/${userId}/lock`),
  unlockUser: (userId) => http.post(`/admin/users/${userId}/unlock`),
}
