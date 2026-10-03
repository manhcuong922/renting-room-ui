// HTTP client dùng chung cho mọi module trong src/api.
// Cài đặt đúng quy ước ở renting_room/docs/api/conventions.md + auth.md:
//   - Gắn Bearer token, chủ động refresh khi token còn < 1 phút.
//   - 401 TOKEN_EXPIRED → refresh ĐÚNG 1 lần rồi gửi lại; chỉ 1 lệnh refresh chạy cùng lúc (kể cả giữa các tab).
//   - Lỗi phiên nhưng tab khác đã có phiên mới hơn → dùng phiên đó, không đăng xuất oan.
//   - 409 IDEMPOTENCY_REQUEST_IN_PROGRESS → chờ Retry-After, gửi lại cùng Idempotency-Key.
//   - Lỗi trả về luôn là ApiError (ProblemDetails đã chuẩn hóa).
import { env } from '@/config/env'
import { ApiError } from './ApiError'
import { authEvents } from './authEvents'
import { tokenStore } from './tokenStore'

const REFRESH_SKEW_MS = 60_000
const MAX_IN_PROGRESS_RETRIES = 3
const REFRESH_LOCK_NAME = 'rr.refresh-token'
const SESSION_END_CODES = new Set([
  'AUTHENTICATION_REQUIRED',
  'INVALID_TOKEN',
  'SESSION_REVOKED',
  'INVALID_REFRESH_TOKEN',
  'TOKEN_EXPIRED',
])

let refreshPromise = null

function buildUrl(path, query) {
  const url = new URL(`${env.apiBaseUrl}${path}`, window.location.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)))
      else url.searchParams.set(key, String(value))
    }
  }
  return url
}

function timeoutSignal(signal) {
  const timeout = AbortSignal.timeout(env.requestTimeoutMs)
  if (!signal) return timeout
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

// Content-Disposition: attachment; filename="a.xlsx"; filename*=UTF-8''danh-s%C3%A1ch.xlsx
function parseFilename(header) {
  if (!header) return null
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header)
  if (star) return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1] : null
}

async function parseBody(response) {
  if (response.status === 204) return null
  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.includes('json')) return response.json()
  if (contentType.startsWith('text/')) return response.text()
  return response.blob()
}

async function send(path, { method, query, body, headers, idempotencyKey, accessToken, signal }) {
  const finalHeaders = new Headers({ Accept: 'application/json', ...headers })
  let payload = body
  if (body !== undefined && !(body instanceof FormData) && !(body instanceof Blob)) {
    finalHeaders.set('Content-Type', 'application/json')
    payload = JSON.stringify(body)
  }
  if (accessToken) finalHeaders.set('Authorization', `Bearer ${accessToken}`)
  if (idempotencyKey) finalHeaders.set('Idempotency-Key', idempotencyKey)

  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      body: payload,
      signal: timeoutSignal(signal),
      // Xác thực bằng Bearer header, KHÔNG dùng cookie → không bao giờ gửi cookie (chặn đường CSRF).
      // Cũng khớp CORS của BE (không bật AllowCredentials).
      credentials: 'omit',
      mode: 'cors',
    })
  } catch (cause) {
    if (signal?.aborted) throw cause // hủy chủ động (React Query unmount…) — không phải lỗi mạng
    if (env.isDev && env.isCrossOriginApi) {
      // Trình duyệt không cho JS biết lỗi là do CORS — chỉ thấy TypeError. Gợi ý nguyên nhân hay gặp.
      console.error(
        `[http] Không gọi được ${env.apiOrigin}. Nếu Network tab báo CORS: thêm "${window.location.origin}" vào ` +
          'Cors:AllowedOrigins của BE, hoặc bỏ VITE_API_BASE_URL để đi qua proxy cùng origin.',
      )
    }
    throw ApiError.network(cause)
  }
}

// Khóa liên tab: refresh token xoay vòng, 2 tab dùng cùng token cũ sẽ khiến cả phiên bị thu hồi.
function withRefreshLock(task) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK_NAME, task)
  }
  return task()
}

// failedRefreshToken: token đã hỏng — chỉ xóa khỏi storage nếu storage vẫn là nó (tránh phá phiên mới của tab khác).
function endSession(error, failedRefreshToken = tokenStore.getOwnRefreshToken()) {
  tokenStore.discard(failedRefreshToken)
  authEvents.emit('session-expired', error)
}

export function refreshSession() {
  let usedRefreshToken = null
  refreshPromise ??= withRefreshLock(async () => {
    // Đọc lại trong khóa: tab khác có thể vừa xoay token.
    usedRefreshToken = tokenStore.getRefreshToken()
    if (!usedRefreshToken) {
      throw new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED', detail: 'Phiên đăng nhập đã hết hạn.' })
    }
    const response = await send('/auth/refresh', { method: 'POST', body: { refreshToken: usedRefreshToken } })
    if (!response.ok) throw await ApiError.fromResponse(response)
    const tokens = await response.json()
    tokenStore.save(tokens)
    // AuthProvider đối chiếu claim (sub/role/pwd_change) với user đang hiển thị.
    authEvents.emit('tokens-refreshed', tokenStore.getClaims())
    return tokens
  })
    .catch((error) => {
      // Lỗi mạng: giữ phiên để thử lại; lỗi xác thực: kết thúc phiên.
      if (error.status === 401 || error.code === 'ORGANIZATION_SUSPENDED') endSession(error, usedRefreshToken)
      throw error
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

async function getAccessToken() {
  const token = tokenStore.getAccessToken()
  const expiresSoon = tokenStore.getAccessTokenExpiresAt() - Date.now() < REFRESH_SKEW_MS
  if ((!token || expiresSoon) && tokenStore.getRefreshToken()) {
    const tokens = await refreshSession()
    return tokens.accessToken
  }
  return token
}

function handleGlobalError(error) {
  if (error.status === 401 && SESSION_END_CODES.has(error.code)) endSession(error)
  else if (error.status === 403 && error.code === 'PASSWORD_CHANGE_REQUIRED') authEvents.emit('password-change-required', error)
  else if (error.status === 403 && error.code === 'FORBIDDEN') authEvents.emit('forbidden', error)
  else if (error.status === 403 && error.code === 'ORGANIZATION_SUSPENDED') endSession(error)
  else if (error.status === 423) endSession(error)
}

/**
 * Gửi request tới API.
 * @param {string} path               Đường dẫn sau /api/v1, VD '/properties'
 * @param {object} [options]
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [options.method]
 * @param {Record<string, unknown>} [options.query]   Bỏ qua giá trị null/undefined/''
 * @param {unknown} [options.body]                    Tự JSON.stringify (trừ FormData/Blob)
 * @param {string} [options.idempotencyKey]           Bắt buộc với các lệnh tạo mới
 * @param {boolean} [options.auth=true]               false cho login/refresh/logout
 * @param {'blob'} [options.responseType]             'blob' → trả { blob, filename } để tải file
 * @param {AbortSignal} [options.signal]
 */
export async function request(path, options = {}) {
  const { method = 'GET', auth = true, signal, responseType, ...rest } = options
  let retriedAuth = false
  let inProgressRetries = 0

  for (;;) {
    const accessToken = auth ? await getAccessToken() : null
    const response = await send(path, { method, accessToken, signal, ...rest })
    if (response.ok) {
      if (responseType !== 'blob') return parseBody(response)
      // Tải file (VD xuất Excel). Lỗi vẫn là JSON ProblemDetails → đã đi nhánh !ok bên dưới.
      return { blob: await response.blob(), filename: parseFilename(response.headers.get('Content-Disposition')) }
    }

    const error = await ApiError.fromResponse(response)

    if (auth && error.status === 401 && !retriedAuth) {
      // TOKEN_EXPIRED → refresh 1 lần. Lỗi phiên khác nhưng tab khác đã có phiên mới hơn
      // (đổi mật khẩu / đăng nhập lại ở tab khác) → dùng phiên đó thay vì đăng xuất oan.
      const canRecover =
        (error.code === 'TOKEN_EXPIRED' && tokenStore.getRefreshToken()) ||
        (SESSION_END_CODES.has(error.code) && tokenStore.hasNewerSessionInStorage())
      if (canRecover) {
        retriedAuth = true
        await refreshSession()
        continue
      }
    }
    if (error.code === 'IDEMPOTENCY_REQUEST_IN_PROGRESS' && inProgressRetries < MAX_IN_PROGRESS_RETRIES) {
      inProgressRetries += 1
      await wait((error.retryAfter ?? 1) * 1000, signal)
      continue
    }

    if (auth) handleGlobalError(error)
    throw error
  }
}

export const http = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}
