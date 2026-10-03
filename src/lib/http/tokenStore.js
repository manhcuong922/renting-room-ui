// Access token chỉ giữ trong bộ nhớ (15 phút); refresh token lưu localStorage để giữ phiên khi tải lại trang
// và dùng chung giữa các tab. Theo docs/api/auth.md#token--làm-mới.
import { readAccessClaims } from './jwt'

const REFRESH_TOKEN_KEY = 'rr.refreshToken'
const REFRESH_EXPIRES_KEY = 'rr.refreshTokenExpiresAt'
// `sub` của phiên đang lưu — tab khác so sánh để biết có bị đổi sang tài khoản khác không.
const SESSION_USER_KEY = 'rr.sessionUser'

let accessToken = null
let accessTokenExpiresAt = 0
let accessClaims = null
// Refresh token đi kèm access token hiện tại của TAB NÀY. Khác giá trị trong storage
// nghĩa là tab khác vừa xoay token / đăng nhập lại / đổi mật khẩu.
let ownRefreshToken = null

function readStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage bị chặn (private mode…) → phiên chỉ sống trong tab hiện tại.
  }
}

function clearMemory() {
  accessToken = null
  accessTokenExpiresAt = 0
  accessClaims = null
  ownRefreshToken = null
}

function removeSession() {
  writeStorage(REFRESH_TOKEN_KEY, null)
  writeStorage(REFRESH_EXPIRES_KEY, null)
  writeStorage(SESSION_USER_KEY, null)
}

function getRefreshToken() {
  const token = readStorage(REFRESH_TOKEN_KEY)
  if (!token) return null
  // Hết hạn (30 ngày) → bỏ luôn, khỏi gửi lên server.
  const expiresAt = Date.parse(readStorage(REFRESH_EXPIRES_KEY) ?? '')
  if (expiresAt && expiresAt <= Date.now()) {
    removeSession()
    return null
  }
  return token
}

export const tokenStore = {
  REFRESH_TOKEN_KEY,
  SESSION_USER_KEY,

  getAccessToken: () => accessToken,
  getAccessTokenExpiresAt: () => accessTokenExpiresAt,
  getClaims: () => accessClaims,
  getRefreshToken,
  getOwnRefreshToken: () => ownRefreshToken,
  getSessionUserId: () => readStorage(SESSION_USER_KEY),
  hasSession: () => Boolean(accessToken || getRefreshToken()),
  hasNewerSessionInStorage() {
    const stored = getRefreshToken()
    return Boolean(stored && stored !== ownRefreshToken)
  },

  save(tokens) {
    accessToken = tokens.accessToken
    accessClaims = readAccessClaims(tokens.accessToken)
    accessTokenExpiresAt = Date.parse(tokens.accessTokenExpiresAt) || accessClaims?.expiresAt || 0
    ownRefreshToken = tokens.refreshToken
    writeStorage(REFRESH_TOKEN_KEY, tokens.refreshToken)
    writeStorage(REFRESH_EXPIRES_KEY, tokens.refreshTokenExpiresAt ?? null)
    writeStorage(SESSION_USER_KEY, accessClaims?.userId ?? null)
  },

  clearMemory,

  // Bỏ phiên đã hỏng: xóa bộ nhớ; chỉ xóa storage nếu storage vẫn là đúng token đã hỏng
  // (không phá phiên mới mà tab khác vừa tạo).
  discard(failedRefreshToken) {
    clearMemory()
    if (failedRefreshToken && readStorage(REFRESH_TOKEN_KEY) === failedRefreshToken) removeSession()
  },

  // Đăng xuất chủ động: xóa hết (các tab khác nhận sự kiện storage và đăng xuất theo).
  clear() {
    clearMemory()
    removeSession()
  },
}
