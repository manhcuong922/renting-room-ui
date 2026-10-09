import { http } from '@/lib/http/client'

// Cài đặt của tổ chức chủ trọ — docs/api/properties.md#bên-cho-thuê, members.md#thời-gian-giữ-dữ-liệu-người-thuê
export const organizationApi = {
  // Thông tin chủ trọ làm bên cho thuê mặc định cho mọi khu: { lessor | null, prefill }. PUT chỉ chủ trọ.
  getLessor: (options) => http.get('/org/lessor', options),
  updateLessor: (body) => http.put('/org/lessor', body),
  revealLessorIdNumber: () => http.post('/org/lessor/reveal-id-number'),
}
