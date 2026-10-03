import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys, roomsApi } from '@/api'

export function useRoomList(params) {
  return useQuery({
    queryKey: queryKeys.rooms.list(params),
    queryFn: ({ signal }) => roomsApi.list(params, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useRoom(id) {
  return useQuery({
    queryKey: queryKeys.rooms.detail(id),
    queryFn: ({ signal }) => roomsApi.get(id, { signal }),
  })
}
