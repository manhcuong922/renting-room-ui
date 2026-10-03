import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui'
import { getErrorMessage } from '@/lib/http/ApiError'

// Mã lỗi cho biết dữ liệu trên màn hình đã cũ (docs/api/errors.md: "Tải lại").
const STALE_CODES = new Set([
  'CONCURRENCY_CONFLICT',
  'CONTRACT_NOT_DRAFT',
  'CONTRACT_NOT_ACTIVE',
  'CONTRACT_NOT_LIQUIDATING',
  'CONTRACT_NOT_EDITABLE',
  'USER_REMOVED',
  'USER_ALREADY_LOCKED',
  'USER_NOT_LOCKED',
  'ORG_ALREADY_SUSPENDED',
  'ORG_NOT_SUSPENDED',
  'PROPERTY_NOT_ARCHIVED',
  'ROOM_NOT_ARCHIVED',
  'ROOM_ALREADY_UNDER_MAINTENANCE',
  'ROOM_NOT_UNDER_MAINTENANCE',
  'CONTRACT_TEMPLATE_ALREADY_ARCHIVED',
  'CONTRACT_TEMPLATE_NOT_ARCHIVED',
  'VEHICLE_ALREADY_ENDED',
  'OCCUPANT_ALREADY_MOVED_OUT',
  'IDEMPOTENCY_REPLAY_UNAVAILABLE',
])

/**
 * Mutation cho nút hành động (khóa, ngừng dùng, kích hoạt…):
 * thành công → toast + invalidate; lỗi "dữ liệu cũ" → tự tải lại; lỗi khác → toast (trừ khi `toastErrors: false`).
 *
 *   const lock = useAction({ mutationFn: (id) => membersApi.lock(id), invalidate: [queryKeys.members.all], success: 'Đã khóa' })
 */
export function useAction({ mutationFn, invalidate = [], success, onSuccess, toastErrors = true }) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      const message = typeof success === 'function' ? success(data, variables) : success
      if (message) toast.success(message)
      onSuccess?.(data, variables)
    },
    onError: (error) => {
      if (STALE_CODES.has(error?.code)) invalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      if (toastErrors) toast.error(getErrorMessage(error))
    },
  })
}

/** Invalidate nhiều khóa sau khi submit form thành công. */
export function useInvalidate() {
  const queryClient = useQueryClient()
  return (...keys) => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
