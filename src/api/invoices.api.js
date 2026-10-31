import { http } from '@/lib/http/client'

// docs/api/invoices.md — phiếu tiền phòng: Nháp → Chốt → thu tiền; sai sau khi chốt thì Hủy rồi lập lại.
// Mọi lệnh sửa / chốt / hủy / hoàn tiền trả 200 + chi tiết phiếu sau khi đổi (dùng luôn, không gọi lại).
export const invoicesApi = {
  // Phân trang; mỗi dòng = phần `summary` của chi tiết phiếu. Lọc thêm: adjusted (đã điều chỉnh), needsResend (cần gửi lại).
  list: (query, options) => http.get('/invoices', { ...options, query }),
  listByRoom: (roomId, query, options) => http.get(`/rooms/${roomId}/invoices`, { ...options, query }),
  // Số tổng hợp trên TOÀN BỘ kết quả lọc (cùng bộ lọc với list).
  totals: (query, options) => http.get('/invoices/totals', { ...options, query }),
  get: (id, options) => http.get(`/invoices/${id}`, options),

  // → { created, recalculated, withIssues, gapsCreated, skipped: [{ contractId, contractNo, roomCode, reason, unbilledPeriods? }] }
  // body.skipUnbilledPeriods: true ⇒ ghi khoảng ngắt cho các kỳ chưa lập (đã thu ngoài hệ thống) rồi tạo phiếu kỳ này.
  generate: (body, { idempotencyKey } = {}) => http.post('/invoices/generate', body, { idempotencyKey }),
  // Mọi khu (propertyIds null) → mảng [{ propertyId, propertyCode, result, errorCode }]
  generateBulk: (body, { idempotencyKey } = {}) => http.post('/invoices/generate-bulk', body, { idempotencyKey }),
  // { invoiceIds } | { propertyId, billingMonth, roomIds, floor } | { propertyId, staleOnly } (+ keepManualEdits) → { recalculated, withIssues, notDraft }
  recalculate: (body) => http.post('/invoices/recalculate', body),

  // Sửa tay dòng hệ thống / sửa dòng nhập tay.
  editLine: (id, lineId, body) => http.put(`/invoices/${id}/lines/${lineId}`, body),
  // Dòng hệ thống: bỏ sửa tay; dòng nhập tay: xóa.
  resetLine: (id, lineId) => http.delete(`/invoices/${id}/lines/${lineId}`),
  // Phụ thu / giảm trừ / hoàn trả (hoàn trả cần sourceInvoiceId).
  addManualLine: (id, body) => http.post(`/invoices/${id}/manual-lines`, body),
  // Cùng một phụ thu / giảm trừ cho nhiều phiếu nháp → { added, results: [{ invoiceId, roomId, roomCode, success, errorCode, message }] }
  bulkManualLines: (body, { idempotencyKey } = {}) => http.post('/invoices/manual-lines', body, { idempotencyKey }),
  updateNote: (id, note) => http.put(`/invoices/${id}/note`, { note }),

  finalize: (id, { idempotencyKey } = {}) => http.post(`/invoices/${id}/finalize`, undefined, { idempotencyKey }),
  // → mảng [{ invoiceId, success, invoiceNo, errorCode, message }]
  finalizeBatch: (invoiceIds, { idempotencyKey } = {}) => http.post('/invoices/finalize-batch', { invoiceIds }, { idempotencyKey }),
  void: (id, reason) => http.post(`/invoices/${id}/void`, { reason }),
  // Xóa nháp → 204
  remove: (id) => http.delete(`/invoices/${id}`),
  // Phiếu tổng âm ("Chờ hoàn"): xác nhận đã trả lại người thuê / bỏ xác nhận.
  confirmRefund: (id, body) => http.post(`/invoices/${id}/refund`, body),
  cancelRefund: (id) => http.delete(`/invoices/${id}/refund`),

  // Lịch sử điều chỉnh chỉ số đã chốt của hóa đơn — mảng, mới nhất trước.
  adjustments: (id, options) => http.get(`/invoices/${id}/adjustments`, options),
  // "Đã gửi lại" cho người thuê sau khi hóa đơn đã chốt bị tính lại → 200 chi tiết (needsResend: false).
  markResent: (id) => http.post(`/invoices/${id}/resent`),
}
