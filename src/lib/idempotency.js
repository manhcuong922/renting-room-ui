// Idempotency-Key cho lệnh tạo mới (conventions.md#idempotency-key--chống-tạo-trùng).
export function newIdempotencyKey() {
  return crypto.randomUUID()
}

// Key đã nhận lỗi 4xx từ server (lệnh bị từ chối, không ghi gì). Server lưu cả kết quả lỗi 24 giờ theo key ⇒ gửi lại CÙNG key với cùng nội dung
// chỉ nhận lại đúng lỗi cũ dù nguyên nhân đã được sửa (VD kích hoạt HĐ 422, sửa ở tab khác rồi bấm lại — L-22). Đánh dấu để
// useIdempotencyKey cấp key mới ở lần gửi sau. Giới hạn kích thước: chỉ cần nhớ các key còn đang nằm trong form.
const MAX_BURNED_KEYS = 200
const burnedKeys = new Set()

export function burnIdempotencyKey(key) {
  if (!key) return
  burnedKeys.add(key)
  if (burnedKeys.size > MAX_BURNED_KEYS) burnedKeys.delete(burnedKeys.values().next().value)
}

export function isIdempotencyKeyBurned(key) {
  return burnedKeys.has(key)
}
