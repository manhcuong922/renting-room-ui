import { http } from '@/lib/http/client'

// docs/api/members.md — xem: mọi thành viên; thao tác: chỉ OrgOwner
export const membersApi = {
  list: (query, options) => http.get('/org/members', { ...options, query }),
  get: (id, options) => http.get(`/org/members/${id}`, options),
  // body.propertyIds: khu được giao (không gửi = mọi khu đang dùng, [] = chưa giao khu nào)
  create: (body, { idempotencyKey }) => http.post('/org/members', body, { idempotencyKey }),
  update: (id, body) => http.put(`/org/members/${id}`, body),
  lock: (id) => http.post(`/org/members/${id}/lock`),
  unlock: (id) => http.post(`/org/members/${id}/unlock`),
  remove: (id) => http.post(`/org/members/${id}/remove`),
  resetPassword: (id) => http.post(`/org/members/${id}/reset-password`),
  // Giao khu cho quản lý khu — thay cả danh sách ([] = không khu nào), có hiệu lực ngay → 200 thành viên (propertyIds). members.md#giao-khu
  assignProperties: (id, propertyIds) => http.put(`/org/members/${id}/properties`, { propertyIds }),
  // Nhật ký đăng nhập của các tài khoản trong tổ chức — chỉ chủ trọ; phân trang, mới nhất trước, giữ 180 ngày.
  loginEvents: (query, options) => http.get('/org/login-events', { ...options, query }),
}
