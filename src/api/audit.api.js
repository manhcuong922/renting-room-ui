import { http } from '@/lib/http/client'

// docs/api/audit.md — nhật ký thao tác của tổ chức: chỉ chủ trọ (quản lý khu → 403). Phân trang, mới nhất trước.
export const auditApi = {
  // ?entityType=&entityId=&userId=&action=&from=&to=&page=&pageSize=
  list: (query, options) => http.get('/audit-logs', { ...options, query }),
}
