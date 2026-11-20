import { http } from '@/lib/http/client'

// docs/api/notifications.md (M11)
export const notificationsApi = {
  // { zalo: { configured, botName }, email: { configured } }
  channels: (options) => http.get('/notifications/channels', options),
  // billingMonth là ngày đầu tháng (yyyy-MM-01)
  summary: (query, options) => http.get('/notifications/summary', { ...options, query }),
  listForInvoice: (invoiceId, options) => http.get(`/invoices/${invoiceId}/notifications`, options),
  // channels: ['Zalo'] | ['Email'] | bỏ trống = mọi kênh người đứng tên có → 202 + danh sách tin vừa tạo
  resend: (invoiceId, channels) => http.post(`/invoices/${invoiceId}/notifications/resend`, channels?.length ? { channels } : {}),
  // { code, expiresAt, botName } — mã thô chỉ trả một lần
  createLinkCode: (renterId) => http.post(`/renters/${renterId}/zalo-link-code`),
  unlinkZalo: (renterId) => http.delete(`/renters/${renterId}/zalo-link`),
  updateSettings: (propertyId, body) => http.put(`/properties/${propertyId}/notification-settings`, body),
  // Thông báo chung của khu (M11 §17): { title, body, roomIds? } — roomIds bỏ trống = mọi phòng đang thuê; chỉ Zalo, gửi ngay mọi giờ
  // → 202 { id, title, roomCount, queued, noChannelRooms: [{ roomId, roomCode }] }
  sendAnnouncement: (propertyId, body, idempotencyKey) => http.post(`/properties/${propertyId}/announcements`, body, { idempotencyKey }),
  listAnnouncements: (propertyId, query, options) => http.get(`/properties/${propertyId}/announcements`, { ...options, query }),
}
