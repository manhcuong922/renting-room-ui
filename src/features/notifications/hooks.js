import { useQuery } from '@tanstack/react-query'
import { notificationsApi, queryKeys } from '@/api'

/** Kênh nào máy chủ đã cấu hình (token Zalo / SMTP) — ẩn / làm mờ nút khi chưa. */
export function useNotificationChannels() {
  return useQuery({
    queryKey: queryKeys.notifications.channels,
    queryFn: ({ signal }) => notificationsApi.channels({ signal }),
    staleTime: 60_000,
  })
}
