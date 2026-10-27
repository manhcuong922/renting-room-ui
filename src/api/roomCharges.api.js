import { http } from '@/lib/http/client'

// docs/api/room-charges.md — khoản phát sinh theo phòng (phụ thu / bù), cuối tháng tự vào phiếu.
// Danh sách trả MẢNG (không phân trang), mới nhất trước. Tạo → 201 khoản vừa tạo; đánh dấu / bỏ đánh dấu / hủy → 200 khoản sau khi đổi.
export const roomChargesApi = {
  listByRoom: (roomId, query, options) => http.get(`/rooms/${roomId}/charges`, { ...options, query }),
  list: (query, options) => http.get('/room-charges', { ...options, query }),
  create: (roomId, body, { idempotencyKey }) => http.post(`/rooms/${roomId}/charges`, body, { idempotencyKey }),
  settle: (id, body) => http.post(`/room-charges/${id}/settle`, body),
  unsettle: (id) => http.delete(`/room-charges/${id}/settle`),
  cancel: (id, reason) => http.post(`/room-charges/${id}/cancel`, { reason }),
  // "Không trả lại" khoản Chênh lệch sau thanh lý đang chờ → 200 khoản (đã hủy)
  waive: (id) => http.post(`/room-charges/${id}/waive`),
}
