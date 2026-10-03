import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { authApi } from '@/api'
import { authEvents } from '@/lib/http/authEvents'
import { tokenStore } from '@/lib/http/tokenStore'
import { AuthContext } from './AuthContext'

const REVALIDATE_MIN_INTERVAL_MS = 60_000

const anonymous = (overrides) => ({
  status: 'anonymous',
  user: null,
  endReason: null,
  endedUserId: null, // user của phiên vừa hết hạn — để không đưa người khác về trang của họ
  loggedOut: false, // đăng xuất chủ động → không nhớ trang cũ
  ...overrides,
})

const initialState = () => (tokenStore.hasSession() ? { ...anonymous(), status: 'loading' } : anonymous())

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState(initialState)
  const userRef = useRef(null)
  useLayoutEffect(() => {
    userRef.current = state.user
  }, [state.user])
  const lastRevalidateRef = useRef(0)

  // Bỏ dữ liệu của phiên cũ: hủy request đang chạy + xóa cache (tránh lộ dữ liệu sang người đăng nhập sau).
  const dropCache = useCallback(() => {
    void queryClient.cancelQueries()
    queryClient.clear()
  }, [queryClient])

  const toAnonymous = useCallback(
    (overrides) => {
      dropCache()
      setState((s) => anonymous({ endedUserId: s.user?.id ?? null, ...overrides }))
    },
    [dropCache],
  )

  // Phiên trong storage thuộc người khác (tab khác đăng nhập tài khoản khác) → khởi động lại phiên.
  const restartSession = useCallback(() => {
    dropCache()
    setState({ ...anonymous(), status: 'loading' })
  }, [dropCache])

  const applyUser = useCallback(
    (user) => {
      const current = userRef.current
      if (current && current.id !== user.id) return restartSession()
      setState({ ...anonymous(), status: 'authenticated', user })
    },
    [restartSession],
  )

  // Khôi phục phiên khi tải lại trang / vào thẳng URL: refresh token → GET /me.
  useEffect(() => {
    if (state.status !== 'loading') return undefined
    let cancelled = false
    authApi
      .me()
      .then((user) => {
        if (!cancelled) setState({ ...anonymous(), status: 'authenticated', user })
      })
      .catch((error) => {
        if (cancelled) return
        if (error.isNetwork || error.status >= 500) setState((s) => ({ ...s, status: 'error', endReason: error }))
        else {
          tokenStore.discard(tokenStore.getOwnRefreshToken())
          toAnonymous({ endReason: error })
        }
      })
    return () => {
      cancelled = true
    }
  }, [state.status, toAnonymous])

  // Kiểm tra lại /me (quyền / khóa / tạm ngưng có thể đã đổi phía server). Có giới hạn tần suất.
  const revalidate = useCallback(
    ({ force = false } = {}) => {
      if (!userRef.current) return
      const now = Date.now()
      if (!force && now - lastRevalidateRef.current < REVALIDATE_MIN_INTERVAL_MS) return
      lastRevalidateRef.current = now
      authApi
        .me()
        .then(applyUser)
        .catch(() => {}) // 401/423… đã được HTTP client xử lý (phát 'session-expired')
    },
    [applyUser],
  )

  // Tín hiệu từ HTTP client.
  useEffect(() => {
    const offs = [
      authEvents.on('session-expired', (error) => toAnonymous({ endReason: error })),
      authEvents.on('password-change-required', () =>
        setState((s) => (s.user ? { ...s, user: { ...s.user, mustChangePassword: true } } : s)),
      ),
      authEvents.on('forbidden', () => revalidate()),
      // Đối chiếu claim của token mới với user đang hiển thị.
      authEvents.on('tokens-refreshed', (claims) => {
        const current = userRef.current
        if (!current || !claims) return
        if (claims.userId && claims.userId !== current.id) return restartSession()
        if (claims.mustChangePassword && !current.mustChangePassword) {
          setState((s) => ({ ...s, user: { ...s.user, mustChangePassword: true } }))
        }
        if (claims.role && claims.role !== current.role) revalidate({ force: true })
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [toAnonymous, restartSession, revalidate])

  // Đồng bộ giữa các tab: tab khác đăng xuất → đăng xuất theo; tab khác đăng nhập → dùng phiên đó;
  // tab khác đăng nhập TÀI KHOẢN KHÁC → bỏ ngay dữ liệu đang hiển thị, khởi động lại theo phiên mới.
  useEffect(() => {
    const onStorage = (event) => {
      if (![tokenStore.REFRESH_TOKEN_KEY, tokenStore.SESSION_USER_KEY, null].includes(event.key)) return
      const sessionUserId = tokenStore.getSessionUserId()
      if (userRef.current && sessionUserId && sessionUserId !== userRef.current.id) {
        tokenStore.clearMemory()
        restartSession()
      } else if (!tokenStore.getRefreshToken()) {
        if (!userRef.current) return
        tokenStore.clearMemory()
        toAnonymous({ loggedOut: true })
      } else if (!userRef.current) {
        setState((s) => (s.status === 'anonymous' ? { ...anonymous(), status: 'loading' } : s))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [toAnonymous, restartSession])

  // Quay lại tab sau một lúc → kiểm tra lại phiên & quyền.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') revalidate()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [revalidate])

  const login = useCallback(async ({ username, password }) => {
    const tokens = await authApi.login({ username, password })
    tokenStore.save(tokens)
    const user = await authApi.me()
    lastRevalidateRef.current = Date.now()
    setState({ ...anonymous(), status: 'authenticated', user })
    return user
  }, [])

  const changePassword = useCallback(async (body) => {
    const tokens = await authApi.changePassword(body)
    tokenStore.save(tokens) // server thu hồi mọi phiên khác → bắt buộc thay token
    const user = await authApi.me()
    setState({ ...anonymous(), status: 'authenticated', user })
    return user
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken()
    tokenStore.clear()
    toAnonymous({ loggedOut: true })
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {})
  }, [toAnonymous])

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll()
    } finally {
      tokenStore.clear()
      toAnonymous({ loggedOut: true })
    }
  }, [toAnonymous])

  const retry = useCallback(() => setState((s) => ({ ...s, status: 'loading' })), [])

  const value = useMemo(
    () => ({ ...state, login, changePassword, logout, logoutAll, retry }),
    [state, login, changePassword, logout, logoutAll, retry],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
