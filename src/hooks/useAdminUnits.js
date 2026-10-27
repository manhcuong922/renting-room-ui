import { useQuery } from '@tanstack/react-query'
import { loadAdminUnits } from '@/lib/adminUnits'

/** Danh mục tỉnh / xã (file tĩnh, tải một lần cho cả phiên). `enabled: false` → chưa tải (VD khối chọn đang đóng). */
export function useAdminUnits({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['static', 'vn-admin-units'],
    queryFn: loadAdminUnits,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
