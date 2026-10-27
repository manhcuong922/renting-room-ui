import { http } from '@/lib/http/client'

// Cài đặt của tổ chức chủ trọ — docs/api/properties.md#bên-cho-thuê, members.md#thời-gian-giữ-dữ-liệu-người-thuê
export const organizationApi = {
  // Thông tin tổ chức (members.md#thông-tin-tổ-chức): mọi thành viên xem; PUT chỉ chủ trọ, mã tổ chức không đổi. → 200 thông tin sau khi sửa
  getInfo: (options) => http.get('/org', options),
  updateInfo: (body) => http.put('/org', body),
  // Thông tin chủ trọ làm bên cho thuê mặc định cho mọi khu: { lessor | null, prefill }. PUT chỉ chủ trọ.
  getLessor: (options) => http.get('/org/lessor', options),
  updateLessor: (body) => http.put('/org/lessor', body),
  revealLessorIdNumber: () => http.post('/org/lessor/reveal-id-number'),
  // Thời gian giữ dữ liệu người thuê (36–120 tháng) + ẩn danh tự động. PUT chỉ chủ trọ.
  getDataRetention: (options) => http.get('/org/data-retention', options),
  updateDataRetention: (body) => http.put('/org/data-retention', body),
}
