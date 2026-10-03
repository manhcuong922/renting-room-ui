import { http } from '@/lib/http/client'

// docs/api/rooms.md
export const roomsApi = {
  list: (query, options) => http.get('/rooms', { ...options, query }),
  get: (id, options) => http.get(`/rooms/${id}`, options),
  create: (propertyId, body, { idempotencyKey }) =>
    http.post(`/properties/${propertyId}/rooms`, body, { idempotencyKey }),
  bulkCreate: (propertyId, body, { idempotencyKey }) =>
    http.post(`/properties/${propertyId}/rooms/bulk`, body, { idempotencyKey }),
  update: (id, body) => http.put(`/rooms/${id}`, body),
  startMaintenance: (id, body) => http.post(`/rooms/${id}/maintenance/start`, body),
  endMaintenance: (id) => http.post(`/rooms/${id}/maintenance/end`),
  archive: (id) => http.post(`/rooms/${id}/archive`),
  restore: (id) => http.post(`/rooms/${id}/restore`),

  listGroups: (propertyId, options) => http.get(`/properties/${propertyId}/room-groups`, options),
  createGroup: (propertyId, body) => http.post(`/properties/${propertyId}/room-groups`, body),
  updateGroup: (groupId, body) => http.put(`/room-groups/${groupId}`, body),
  deleteGroup: (groupId) => http.delete(`/room-groups/${groupId}`),
  setGroupMembers: (groupId, body) => http.put(`/room-groups/${groupId}/members`, body),
}
