import { QueryClient } from '@tanstack/react-query'

// Không retry lỗi 4xx (lỗi nghiệp vụ/quyền) và 429 (docs: không tự retry liên tục).
function shouldRetry(failureCount, error) {
  if (error?.status >= 400 && error?.status < 500) return false
  return failureCount < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
})
