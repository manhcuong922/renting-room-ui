import { useQuery } from '@tanstack/react-query'
import { propertiesApi, queryKeys, roomsApi } from '@/api'

// API giới hạn pageSize ≤ 100 → tải tuần tự đủ mọi trang (một khu có thể tới vài trăm phòng).
async function fetchAllPages(fetchPage, signal) {
  const first = await fetchPage(1, signal)
  const items = [...first.items]
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await fetchPage(page, signal)
    items.push(...next.items)
  }
  return items
}

/** Toàn bộ khu (ô chọn khu). */
export function usePropertyOptions({ includeArchived = false } = {}) {
  const params = { includeArchived: includeArchived || undefined }
  return useQuery({
    queryKey: queryKeys.properties.list({ ...params, all: true }),
    queryFn: ({ signal }) => fetchAllPages((page) => propertiesApi.list({ ...params, page, pageSize: 100 }, { signal }), signal),
    staleTime: 60_000,
  })
}

/** Toàn bộ phòng của một khu (sơ đồ phòng, chọn phòng cho nhóm / xuất Excel / hợp đồng). */
export function usePropertyRooms(propertyId, { status } = {}) {
  const params = { propertyId, status: status || undefined }
  return useQuery({
    queryKey: queryKeys.rooms.list({ ...params, all: true }),
    queryFn: ({ signal }) => fetchAllPages((page) => roomsApi.list({ ...params, page, pageSize: 100 }, { signal }), signal),
    enabled: Boolean(propertyId),
  })
}

export function useRoomGroups(propertyId) {
  return useQuery({
    queryKey: queryKeys.rooms.groups(propertyId),
    queryFn: ({ signal }) => roomsApi.listGroups(propertyId, { signal }),
    enabled: Boolean(propertyId),
  })
}
