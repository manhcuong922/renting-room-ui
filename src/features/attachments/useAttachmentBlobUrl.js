import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { attachmentsApi } from '@/api'

/**
 * Tải nội dung tệp (cần token nên không dùng thẳng <img src>) và đổi thành URL tạm của trình duyệt.
 * `retain: false` (tệp nhạy cảm) → không giữ trong bộ nhớ đệm sau khi đóng hộp xem, và mỗi lần mở là một lần tải có ghi nhật ký.
 */
export function useAttachmentBlobUrl(id, { inline = false, enabled = true, retain = true } = {}) {
  const query = useQuery({
    queryKey: ['attachments', 'blob', id, inline],
    queryFn: async ({ signal }) => (await attachmentsApi.content(id, { inline }, { signal })).blob,
    enabled,
    staleTime: retain ? Infinity : 0,
    gcTime: retain ? 5 * 60_000 : 0,
    retry: false,
  })
  const blob = query.data
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!blob) return undefined
    const objectUrl = URL.createObjectURL(blob)
    // Đồng bộ với tài nguyên của trình duyệt (blob URL phải được tạo và thu hồi theo vòng đời effect, an toàn với StrictMode) — không thể suy ra khi render.
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [blob])

  return { url, isPending: enabled && (query.isPending || (Boolean(blob) && !url)), error: query.error }
}
