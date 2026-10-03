import { Navigate, Outlet, useLocation, useMatches } from 'react-router'
import { ErrorState, PageLoader } from '@/components/ui'
import { env } from '@/config/env'
import { getHomePath } from '@/config/navigation'
import { ForbiddenState } from './access'
import { useAuth } from './AuthContext'
import { hasPermission } from './permissions'

const LOGIN_PATH = '/login'
const CHANGE_PASSWORD_PATH = '/change-password'
const AUTH_PATHS = new Set([LOGIN_PATH, CHANGE_PASSWORD_PATH])

/**
 * Cổng 1 — phải đăng nhập. Mọi route nghiệp vụ nằm dưới đây (gõ URL trực tiếp khi chưa đăng nhập → /login).
 * Đang khôi phục phiên → chỉ hiện loader, không bao giờ render nội dung được bảo vệ trước khi biết user là ai.
 * mustChangePassword → chỉ được ở màn đổi mật khẩu (khớp PasswordChangedRequirement của BE).
 */
export function RequireAuth() {
  const { status, user, endReason, endedUserId, loggedOut, retry } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoader fullScreen label="Đang khôi phục phiên đăng nhập…" />
  if (status === 'error') {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <ErrorState error={endReason} title="Không kết nối được máy chủ" onRetry={retry} />
      </div>
    )
  }
  if (status !== 'authenticated') {
    // Đăng xuất chủ động → không nhớ trang cũ (người đăng nhập sau không bị đưa về trang của người trước).
    const state = loggedOut ? undefined : { from: location, forUserId: endedUserId }
    return <Navigate to={LOGIN_PATH} replace state={state} />
  }

  const onChangePasswordPage = location.pathname === CHANGE_PASSWORD_PATH
  if (user.mustChangePassword && !onChangePasswordPage) return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  if (!user.mustChangePassword && onChangePasswordPage) return <Navigate to={getHomePath(user)} replace />

  return <Outlet />
}

/** Cổng cho màn đăng nhập: đã đăng nhập → quay lại trang định vào (nếu hợp lệ) hoặc trang chủ. */
export function GuestOnly() {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <PageLoader fullScreen />
  if (status === 'authenticated') return <Navigate to={resolveReturnPath(location.state, user)} replace />
  return <Outlet />
}

// Chỉ chấp nhận đường dẫn nội bộ; phiên hết hạn của người A không đưa người B về trang của A.
function resolveReturnPath(state, user) {
  const home = getHomePath(user)
  const from = state?.from
  if (!from?.pathname || AUTH_PATHS.has(from.pathname)) return home
  if (state.forUserId && state.forUserId !== user.id) return home
  const path = `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return home
  return path
}

/**
 * Cổng 2 — quyền theo route, MẶC ĐỊNH CHẶN (giống fallback policy của BE).
 * Mỗi route khai báo `handle: { permission }`; route con kế thừa của route cha gần nhất.
 * Thiếu khai báo → chặn + cảnh báo ở dev. Bị chặn thì trang (lazy chunk) không được tải.
 */
export function RouteAccessGate({ children }) {
  const { user } = useAuth()
  const matches = useMatches()
  const permission = matches.findLast((m) => m.handle?.permission)?.handle.permission

  if (!permission) {
    if (env.isDev) console.error(`[auth] Route "${matches.at(-1)?.pathname}" chưa khai báo handle.permission → bị chặn.`)
    return <ForbiddenState />
  }
  if (!hasPermission(user, permission)) return <ForbiddenState />
  return children
}

export function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={getHomePath(user)} replace />
}
