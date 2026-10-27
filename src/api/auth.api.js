import { http } from '@/lib/http/client'

// docs/api/auth.md
export const authApi = {
  login: (body) => http.post('/auth/login', body, { auth: false }),
  changePassword: (body) => http.post('/auth/change-password', body),
  logout: (refreshToken) => http.post('/auth/logout', { refreshToken }, { auth: false }),
  logoutAll: () => http.post('/auth/logout-all'),
  me: (options) => http.get('/me', options),
  // Chủ trọ / SystemAdmin tự sửa họ tên, SĐT, email. Đổi SĐT / email phải kèm currentPassword và mọi phiên bị vô hiệu. → 204
  updateMe: (body) => http.put('/me', body),
}
