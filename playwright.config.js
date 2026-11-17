import { defineConfig } from '@playwright/test'

// E2E chạy trình duyệt THẬT để xem luồng: `npm run e2e` (có cửa sổ, làm chậm từng thao tác) · `npm run e2e:fast` (ẩn, nhanh).
// Bộ spec đăng nhập nhiều lần trong vài phút ⇒ chạm giới hạn đăng nhập (20/phút/IP, 5/phút/tài khoản). Khởi động API test với
//   RateLimiting__Login__PermitLimit=500 RateLimiting__LoginPerAccount__PermitLimit=500   (chỉ cho API test cục bộ, đừng nới ở môi trường thật).
// Cần sẵn: API ở http://localhost:5213 (profile "http", Development, DB có dữ liệu demo) và UI ở http://localhost:5173 (`npm run dev`).
const headed = process.env.E2E_HEADLESS !== '1'

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    headless: !headed,
    viewport: { width: 1360, height: 860 },
    launchOptions: { slowMo: headed ? Number(process.env.E2E_SLOWMO ?? 600) : 0 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
