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
  // Lệnh hàng loạt (tạo / chốt nhiều phiếu, nhập Excel, tạo phòng loạt, xuất Excel lớn) có thể chạy lâu hơn 30 giây trên khu lớn. Quá 30 giây mà UI
  // báo lỗi mạng trong khi server vẫn chạy ⇒ bấm lại sinh lượt thứ 2 (L-23). 120 giây = InProgressTimeoutSeconds của server: hết hạn mà vẫn chưa
  // xong thì gửi lại cùng Idempotency-Key sẽ được chờ / trả kết quả của lượt đang chạy (409 IDEMPOTENCY_REQUEST_IN_PROGRESS → client.js tự thử lại).
  bulkRequestTimeoutMs: 120_000,
  isDev: import.meta.env.DEV,
})

if (env.isCrossOriginApi && window.location.protocol === 'https:' && apiOrigin.startsWith('http:')) {
  // Trang https gọi API http → trình duyệt chặn (mixed content).
  console.error(`[config] VITE_API_BASE_URL (${apiOrigin}) phải dùng https khi trang chạy https.`)
}
