import { http } from '@/lib/http/client'

// docs/api/meters.md — công tơ đi theo phòng, tối đa 1 công tơ đang hoạt động cho mỗi khoản điện / nước.
export const metersApi = {
  listByRoom: (roomId, query, options) => http.get(`/rooms/${roomId}/meters`, { ...options, query }),
  // → 201 { id }
  install: (roomId, body, { idempotencyKey }) => http.post(`/rooms/${roomId}/meters`, body, { idempotencyKey }),
  // Thay: số cuối công tơ cũ + số đầu công tơ mới, cùng ngày → 201 { id: công tơ mới }
  replace: (id, body, { idempotencyKey }) => http.post(`/meters/${id}/replace`, body, { idempotencyKey }),
  // Tháo (không thay) → 200 { warnings }
  remove: (id, body) => http.post(`/meters/${id}/remove`, body),
  // Lịch sử chỉ số — mảng, mới nhất trước.
  readings: (id, options) => http.get(`/meters/${id}/readings`, options),
  // → 200 chỉ số sau khi sửa; hóa đơn nháp dùng công tơ này tự tính lại.
  correctReading: (readingId, body) => http.put(`/meter-readings/${readingId}`, body),
  // Điều chỉnh chỉ số đã chốt (PUT trả READING_LOCKED): { value, reason, handling?, settlement?, notReturned? }
  // → 200 { reading, handling, invoice, charge, payments, warnings }
  adjustReading: (readingId, body, { idempotencyKey }) => http.post(`/meter-readings/${readingId}/adjust`, body, { idempotencyKey }),
  // Hủy chỉ số cuối kỳ / kiểm tra ghi nhầm → 204
  voidReading: (readingId, body) => http.post(`/meter-readings/${readingId}/void`, body),

  // Lưới ghi chỉ số cuối kỳ của khu theo tháng thu → { billingMonth, rows }
  readingSheet: (propertyId, query, options) => http.get(`/properties/${propertyId}/meter-reading-sheet`, { ...options, query }),
  // Cả lô hoặc không gì → 200 { saved, warnings } · 422 READINGS_INVALID kèm rowErrors
  saveReadings: (propertyId, body, { idempotencyKey } = {}) => http.put(`/properties/${propertyId}/meter-readings`, body, { idempotencyKey }),

  // Lắp hàng loạt: phòng chưa có công tơ đang hoạt động của khoản thu → [{ roomId, roomCode, floor }]
  installSheet: (propertyId, query, options) => http.get(`/properties/${propertyId}/meters/install-sheet`, { ...options, query }),
  // → 200 { installed, meterIds } · 422 BULK_INSTALL_INVALID kèm rowErrors (không lưu dòng nào)
  bulkInstall: (propertyId, body, { idempotencyKey }) => http.post(`/properties/${propertyId}/meters/bulk`, body, { idempotencyKey }),
  // Thay hàng loạt: công tơ đang hoạt động của khoản thu → [{ meterId, roomId, roomCode, floor, serialNo, lastValue, lastDate }]
  replaceSheet: (propertyId, query, options) => http.get(`/properties/${propertyId}/meters/replace-sheet`, { ...options, query }),
  // → 200 { replaced, newMeterIds } · 422 BULK_REPLACE_INVALID kèm rowErrors
  bulkReplace: (propertyId, body, { idempotencyKey }) => http.post(`/properties/${propertyId}/meters/bulk-replace`, body, { idempotencyKey }),
  // Điện nước chạy lúc phòng trống → { from, to, rows, totals }
  vacantUsage: (propertyId, query, options) => http.get(`/properties/${propertyId}/meters/vacant-usage`, { ...options, query }),
}
