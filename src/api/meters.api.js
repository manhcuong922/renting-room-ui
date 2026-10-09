import { http } from '@/lib/http/client'

// docs/api/meters.md — hiện chỉ đọc công tơ của phòng (chỉ số nhận phòng khi kích hoạt, chỉ số cuối khi trả phòng).
export const metersApi = {
  listByRoom: (roomId, query, options) => http.get(`/rooms/${roomId}/meters`, { ...options, query }),
}
