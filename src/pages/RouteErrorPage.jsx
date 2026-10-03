import { isRouteErrorResponse, useRouteError } from 'react-router'
import { ErrorState } from '@/components/ui'
import { env } from '@/config/env'
import NotFoundPage from './NotFoundPage'

// errorElement của router: bắt lỗi render/lazy-load để không trắng cả trang.
export default function RouteErrorPage() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />

  if (env.isDev) console.error(error)
  // Lỗi tải chunk sau khi deploy bản mới → tải lại trang là hết.
  const isChunkError = error instanceof TypeError && /dynamically imported module|Importing a module script/i.test(error.message)

  return (
    <ErrorState
      title={isChunkError ? 'Ứng dụng vừa được cập nhật' : 'Đã có lỗi xảy ra'}
      description={isChunkError ? 'Tải lại trang để dùng phiên bản mới nhất.' : 'Vui lòng tải lại trang. Nếu lỗi lặp lại, hãy báo bộ phận hỗ trợ.'}
      onRetry={() => window.location.reload()}
    />
  )
}
