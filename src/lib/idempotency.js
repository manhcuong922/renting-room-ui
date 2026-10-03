// Idempotency-Key cho lệnh tạo mới (conventions.md#idempotency-key--chống-tạo-trùng).
export function newIdempotencyKey() {
  return crypto.randomUUID()
}
