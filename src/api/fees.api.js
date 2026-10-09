import { http } from '@/lib/http/client'

// docs/api/fees.md — hiện chỉ dùng phần đọc danh mục khoản thu của khu (bước Khoản thu khi tạo / sửa HĐ).
export const feesApi = {
  listByProperty: (propertyId, query, options) => http.get(`/properties/${propertyId}/fee-types`, { ...options, query }),
}
