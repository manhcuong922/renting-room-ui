import { expect, test } from '@playwright/test'

// Quét mọi màn hình của chủ trọ demo ở 2 độ rộng: không lỗi console, không API 4xx/5xx ngoài dự kiến, không tràn ngang trang,
// không có chữ bị cắt thành cột 1 ký tự (dấu hiệu bố cục vỡ như bộ lọc bị ép hẹp). Cần API :5213 có dữ liệu demo + UI :5173.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-all-pages.spec.js
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const VIEWPORTS = [
  { name: 'desktop', width: 1360, height: 860 },
  { name: 'mobile', width: 390, height: 800 },
  { name: 'mobile-small', width: 360, height: 740 },
]

// Trang danh sách / tĩnh. Trang chi tiết lấy từ liên kết đầu tiên của danh sách tương ứng.
const STATIC_ROUTES = [
  '/dashboard', '/properties', '/rooms', '/renters', '/contracts', '/contracts/new', '/contracts/review',
  '/contract-templates', '/meter-readings', '/invoices', '/room-charges', '/audit-logs', '/tenancy-history',
  '/members', '/organization', '/profile',
]
const DETAIL_SOURCES = [
  { list: '/properties', href: /^\/properties\/(?!new)[^/]+$/ },
  { list: '/rooms', href: /^\/rooms\/[^/]+$/ },
  { list: '/renters', href: /^\/renters\/[^/]+$/ },
  { list: '/contracts', href: /^\/contracts\/(?!new|review)[^/]+$/ },
  { list: '/invoices', href: /^\/invoices\/[^/]+$/ },
  { list: '/contract-templates', href: /^\/contract-templates\/(?!new)[^/]+$/ },
]

// API trả 4xx hợp lệ theo nghiệp vụ (vd. quyền, chưa có dữ liệu) — không tính là lỗi.
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

async function login(page) {
  // E2E_THEME=dark|light: quét toàn bộ trang ở chế độ giao diện đó (mặc định theo hệ điều hành = sáng).
  if (process.env.E2E_THEME) await page.addInitScript((theme) => localStorage.setItem('rr-theme', theme), process.env.E2E_THEME)
  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)
}

/** Điều hướng trong SPA (không tải lại trang — tải lại gọi /auth/refresh, bị giới hạn tốc độ nếu quét nhiều trang). */
async function go(page, path) {
  await page.evaluate((to) => {
    history.pushState({}, '', to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
}

/** Dấu hiệu bố cục vỡ: tràn ngang; nút / nhãn rộng bị bẻ thành nhiều dòng quá cao so với bề rộng. */
async function layoutProblems(page) {
  return page.evaluate(() => {
    const problems = []
    const doc = document.documentElement
    if (doc.scrollWidth > doc.clientWidth + 1) problems.push(`tràn ngang: scrollWidth ${doc.scrollWidth} > ${doc.clientWidth}`)
    for (const el of document.querySelectorAll('[role="radiogroup"], [role="tablist"], button, label')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right > window.innerWidth + 1 && !el.closest('[data-allow-scroll], [role="tablist"], [class*="stepper"], table, [class*="scroll"], [class*="table"]'))
        problems.push(`ra ngoài màn hình: <${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 40)}"`)
      if (el.tagName === 'LABEL' && el.closest('[role="radiogroup"]') && r.height > 90)
        problems.push(`nhóm nút phân đoạn bị ép hẹp: "${(el.textContent || '').trim().slice(0, 40)}" cao ${Math.round(r.height)}px`)
    }
    return problems
  })
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('mọi màn hình mở được, không lỗi, không vỡ bố cục', async ({ page }, testInfo) => {
      const issues = []
      let current = ''
      page.on('console', (m) => {
        if (m.type() === 'error') issues.push(`[${current}] console.error: ${m.text().slice(0, 160)}`)
      })
      page.on('pageerror', (e) => issues.push(`[${current}] pageerror: ${e.message.slice(0, 160)}`))
      page.on('response', (r) => {
        const s = r.status()
        if (s >= 400 && !IGNORED_STATUS.has(s) && r.url().includes('/api/')) issues.push(`[${current}] HTTP ${s} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
      })

      await login(page)

      const visit = async (path) => {
        current = path
        await go(page, path)
        await expect(page.locator('main, [role="main"]').first()).toBeVisible()
        const body = (await page.locator('body').innerText()).slice(0, 4000)
        if (/Đã xảy ra lỗi|Something went wrong|Không tìm thấy trang/i.test(body) && path !== '/nope') issues.push(`[${path}] hiện màn hình lỗi / 404`)
        for (const p of await layoutProblems(page)) issues.push(`[${path}] ${p}`)
        const file = `test-results/smoke-${vp.name}-${path.replace(/[^a-z0-9]+/gi, '_')}.png`
        await page.screenshot({ path: file, fullPage: true })
      }

      for (const path of STATIC_ROUTES) await visit(path)

      for (const src of DETAIL_SOURCES) {
        await go(page, src.list)
        // Firefox / WebKit vẽ danh sách chậm hơn "networkidle": chờ tới 10 giây cho liên kết chi tiết xuất hiện.
        let href
        for (let attempt = 0; attempt < 20 && !href; attempt++) {
          const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
          href = hrefs.find((h) => src.href.test(h))
          if (!href) await page.waitForTimeout(500)
        }
        if (href) await visit(href)
        else if (src.list !== '/contract-templates') issues.push(`[${src.list}] không tìm thấy liên kết chi tiết để kiểm`) // dữ liệu demo chưa có mẫu HĐ
      }

      await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
      expect(issues, issues.join('\n')).toEqual([])
    })
  })
}
