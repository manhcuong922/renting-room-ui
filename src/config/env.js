// Cấu hình đọc từ biến môi trường Vite (xem .env.example).
function trimTrailingSlash(value) {
  let end = value.length
  while (end > 1 && value[end - 1] === '/') end -= 1
  return value.slice(0, end)
}

const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || '/api/v1')
const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin

export const env = Object.freeze({
  apiBaseUrl,
  apiOrigin,
  // true → trình duyệt áp CORS: origin của trang phải nằm trong Cors:AllowedOrigins của BE.
  isCrossOriginApi: apiOrigin !== window.location.origin,
  requestTimeoutMs: 30_000,
  isDev: import.meta.env.DEV,
})

if (env.isCrossOriginApi && window.location.protocol === 'https:' && apiOrigin.startsWith('http:')) {
  // Trang https gọi API http → trình duyệt chặn (mixed content).
  console.error(`[config] VITE_API_BASE_URL (${apiOrigin}) phải dùng https khi trang chạy https.`)
}
