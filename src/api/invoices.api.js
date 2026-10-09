import { http } from '@/lib/http/client'

// docs/api/invoices.md — hiện chỉ đọc danh sách phiếu của HĐ (theo dõi phiếu quyết toán khi thanh lý).
export const invoicesApi = {
  list: (query, options) => http.get('/invoices', { ...options, query }),
}
