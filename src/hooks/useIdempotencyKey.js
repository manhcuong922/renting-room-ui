import { useMemo, useRef } from 'react'
import { newIdempotencyKey } from '@/lib/idempotency'

/**
 * Idempotency-Key theo "phiên thao tác" của form (conventions.md#idempotency-key):
 *  - Gửi lại CÙNG nội dung (retry, mất mạng) → giữ nguyên key → server trả lại kết quả cũ, không tạo trùng.
 *  - Nội dung đã sửa → key mới (cùng key khác nội dung = 422 IDEMPOTENCY_KEY_REUSED).
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
        if (!stateRef.current.key || stateRef.current.payload !== serialized) {
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
