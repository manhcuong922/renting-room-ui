import { http } from '@/lib/http/client'

// docs/api/renters.md
export const rentersApi = {
  // Theo tên (không dấu) / SĐT.
  list: (query, options) => http.get('/renters', { ...options, query }),
  // Có số giấy tờ: số đi trong BODY, không đặt trên URL (log proxy, lịch sử trình duyệt, Referer). Chỉ đọc — không cần Idempotency-Key.
  search: (body, options) => http.post('/renters/search', body, options),
  get: (id, options) => http.get(`/renters/${id}`, options),
  create: (body, { idempotencyKey }) => http.post('/renters', body, { idempotencyKey }),
  update: (id, body) => http.put(`/renters/${id}`, body),
  revealIdNumber: (id) => http.post(`/renters/${id}/reveal-id-number`),
  // Chỉ chủ trọ, không đảo ngược.
  anonymize: (id, body) => http.post(`/renters/${id}/anonymize`, body),
  // Ẩn hồ sơ khỏi danh sách / ô chọn (không xóa dữ liệu, khác ẩn danh) / hiện lại → 204
  archive: (id) => http.post(`/renters/${id}/archive`),
  restore: (id) => http.post(`/renters/${id}/restore`),
  // Sổ ghi nhận đồng ý xử lý dữ liệu cá nhân — mảng, mới nhất trước
  consents: (id, options) => http.get(`/renters/${id}/consents`, options),
  addConsent: (id, body) => http.post(`/renters/${id}/consents`, body),
  withdrawConsent: (id, consentId, withdrawnOn) => http.post(`/renters/${id}/consents/${consentId}/withdraw`, { withdrawnOn }),
}
