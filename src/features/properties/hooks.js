import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { propertiesApi, queryKeys } from '@/api'

// Mẫu chuẩn cho mọi danh sách phân trang: key theo params, truyền signal để hủy request cũ,
// giữ dữ liệu trang trước khi chuyển trang (không nháy loading).
export function usePropertyList(params) {
  return useQuery({
    queryKey: queryKeys.properties.list(params),
    queryFn: ({ signal }) => propertiesApi.list(params, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useProperty(id) {
  return useQuery({
    queryKey: queryKeys.properties.detail(id),
    queryFn: ({ signal }) => propertiesApi.get(id, { signal }),
    enabled: Boolean(id),
  })
}
