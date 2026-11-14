import { useMemo, useRef } from 'react'
import { isIdempotencyKeyBurned, newIdempotencyKey } from '@/lib/idempotency'

/**
 * Idempotency-Key theo "phiên thao tác" của form (conventions.md#idempotency-key):
 *  - Gửi lại CÙNG nội dung (retry, mất mạng) → giữ nguyên key → server trả lại kết quả cũ, không tạo trùng.
 *  - Nội dung đã sửa → key mới (cùng key khác nội dung = 422 IDEMPOTENCY_KEY_REUSED).
 *  - Server đã trả lỗi 4xx cho key này (lệnh bị từ chối, không ghi gì) → key mới, vì server giữ cả kết quả lỗi 24 giờ và sẽ trả lại
 *    đúng lỗi cũ dù nguyên nhân đã được sửa (L-22; client.js đánh dấu bằng burnIdempotencyKey).
 *
 *   const idem = useIdempotencyKey()
 *   await api.create(body, { idempotencyKey: idem.keyFor(body) })
 *   idem.reset() // sau khi tạo xong, mở form mới
 */
export function useIdempotencyKey() {
  const stateRef = useRef({ key: null, payload: null })

  return useMemo(
    () => ({
      keyFor(payload) {
        const serialized = JSON.stringify(payload ?? null)
        const { key, payload: previous } = stateRef.current
        if (!key || previous !== serialized || isIdempotencyKeyBurned(key)) {
          stateRef.current = { key: newIdempotencyKey(), payload: serialized }
        }
        return stateRef.current.key
      },
      reset() {
        stateRef.current = { key: null, payload: null }
      },
    }),
    [],
  )
}
