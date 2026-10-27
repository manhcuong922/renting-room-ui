import { http } from '@/lib/http/client'

// docs/api/members.md — xem: mọi thành viên; thao tác: chỉ OrgOwner
export const membersApi = {
  list: (query, options) => http.get('/org/members', { ...options, query }),
  get: (id, options) => http.get(`/org/members/${id}`, options),
  create: (body, { idempotencyKey }) => http.post('/org/members', body, { idempotencyKey }),
  update: (id, body) => http.put(`/org/members/${id}`, body),
  lock: (id) => http.post(`/org/members/${id}/lock`),
  unlock: (id) => http.post(`/org/members/${id}/unlock`),
  remove: (id) => http.post(`/org/members/${id}/remove`),
  resetPassword: (id) => http.post(`/org/members/${id}/reset-password`),
  // Cấp / thu hồi quyền xem số giấy tờ đầy đủ của phó quản lý — có hiệu lực ngay.
  setSensitiveDataAccess: (id, allowed) => http.put(`/org/members/${id}/sensitive-data-access`, { allowed }),
  // Bật / tắt quyền bỏ nợ cho riêng từng phó quản lý (mặc định tắt) → 200 thành viên (canWriteOff).
  setWriteOffPermission: (id, allowed) => http.put(`/org/members/${id}/write-off-permission`, { allowed }),
  // Nhật ký đăng nhập của các tài khoản trong tổ chức — chỉ chủ trọ; phân trang, mới nhất trước, giữ 180 ngày.
  loginEvents: (query, options) => http.get('/org/login-events', { ...options, query }),
}
