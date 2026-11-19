import { expect, test } from '@playwright/test'

// Khu & quản lý khu (UI thật): sửa thông tin chung và bên cho thuê của khu, xem "Sản lượng phòng trống", và quản lý khu THAO TÁC thật:
// không thấy nút tạo khu / thêm quản lý, thu được tiền và có nút "Bỏ nợ" trên phiếu của khu mình (quyền mặc định từ 08/11).
// GHI dữ liệu — chỉ chạy trên DB seed dùng một lần. Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-v9-property-manager.spec.js
const API = process.env.E2E_API_URL ?? 'http://localhost:5213/api/v1'
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const MANAGER = { phone: '0900000008', password: 'PhoQuanLy2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.use({ actionTimeout: 15_000 })
test.setTimeout(240_000)

async function go(page, to) {
  await page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, to)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

test('khu: sửa thông tin & bên cho thuê, phòng trống; quản lý khu thao tác thật', async ({ page, browser, request }, testInfo) => {
  const issues = []
  let step = ''
  const watch = (p) => {
    p.on('console', (m) => m.type() === 'error' && !/status of (400|401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
    p.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
    p.on('response', (r) => {
      if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
    })
  }
  watch(page)
  const shot = (name) => page.screenshot({ path: `test-results/prop9-${name}.png`, fullPage: true })
  const run = async (name, fn) => {
    step = name
    try {
      await fn()
    } catch (e) {
      issues.push(`[${name}] ${String(e.message).split('\n').slice(0, 5).join(' | ').slice(0, 600)}`)
      await shot(`fail-${name.replace(/\W+/g, '_').slice(0, 30)}`).catch(() => {})
      await page.keyboard.press('Escape').catch(() => {})
    }
  }
  const main = () => page.locator('main')
  const toast = (re) => expect(page.getByText(re).first()).toBeVisible({ timeout: 15_000 })
  const unique = Date.now().toString().slice(-6)

  const token = (await (await request.post(`${API}/auth/login`, { data: { username: OWNER.phone, password: OWNER.password } })).json()).accessToken
  const invoices = (await (await request.get(`${API}/invoices?pageSize=100&status=Finalized`, { headers: { Authorization: `Bearer ${token}` } })).json()).items
  const properties = (await (await request.get(`${API}/properties`, { headers: { Authorization: `Bearer ${token}` } })).json()).items
  const propA = properties.find((p) => p.code === 'A')
  const owing = invoices.find((i) => i.propertyId === propA.id && i.type === 'Regular' && i.outstanding > 100000)
  expect(owing, 'khu A không có phiếu đã chốt còn nợ').toBeTruthy()

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  const openPropertyTab = async (code, tab) => {
    await go(page, '/properties')
    await page.locator('a[href^="/properties/"]:not([href="/properties/new"])').filter({ hasText: new RegExp(`Khu ${code}|^${code}\\b`) }).first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', typeof tab === 'string' ? { name: tab, exact: true } : { name: tab }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
  }

  await run('Thông tin chung của khu: sửa mô tả → lưu → còn nguyên', async () => {
    await openPropertyTab('A', 'Thông tin chung')
    await page.getByLabel('Mô tả').fill(`Khu thử nghiệm ${unique}`)
    await page.locator('form button[type="submit"]').first().click()
    await toast(/Đã lưu|Đã cập nhật|đã cập nhật/i)
    await openPropertyTab('A', 'Thông tin chung')
    await expect(page.getByLabel('Mô tả')).toHaveValue(`Khu thử nghiệm ${unique}`)
  })

  await run('Bên cho thuê của khu A: sửa SĐT → lưu', async () => {
    await openPropertyTab('A', /^Bên cho thuê/)
    await page.getByRole('button', { name: 'Khai riêng cho khu này' }).click()
    await page.locator('label', { hasText: /^Tổ chức$/ }).click()
    await page.getByLabel('Tên tổ chức').fill(`Công ty Bên A ${unique}`)
    await page.getByLabel('Mã số thuế').fill('0312345678')
    await page.getByLabel('Họ tên người đại diện').fill('Nguyễn Văn Đại')
    await page.getByLabel('Chức vụ').fill('Giám đốc')
    await page.getByLabel('Số điện thoại').first().fill('0988777666')
    await page.getByLabel('Địa chỉ').fill('12 Nguyễn Trãi, Hà Nội')
    await page.getByRole('button', { name: 'Lưu bên cho thuê riêng' }).click()
    await toast(/Đã lưu|Đã cập nhật|đã cập nhật/i)
    await shot('1-lessor')
  })

  await run('Công tơ: "Sản lượng phòng trống" hiển thị', async () => {
    await openPropertyTab('A', 'Công tơ')
    await page.locator('label', { hasText: /Sản lượng phòng trống/ }).click()
    await page.waitForLoadState('networkidle')
    await expect(main()).toContainText(/Nhận phòng từ ngày|sản lượng phòng trống/i)
    await shot('2-vacant-usage')
  })

  // ------------------------------------------------------------- Quản lý khu thao tác thật
  await run('Quản lý khu: không có nút tạo khu / thêm quản lý', async () => {
    const context = await browser.newContext()
    const manager = await context.newPage()
    watch(manager)
    await manager.goto('/login')
    await manager.getByLabel('Số điện thoại hoặc email').fill(MANAGER.phone)
    await manager.getByRole('textbox', { name: 'Mật khẩu' }).fill(MANAGER.password)
    await manager.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(manager).not.toHaveURL(/login/)
    const nav = async (to) => {
      await manager.evaluate((t) => {
        history.pushState({}, '', t)
        dispatchEvent(new PopStateEvent('popstate'))
      }, to)
      await manager.waitForLoadState('networkidle')
      await manager.waitForTimeout(600)
    }
    await nav('/properties')
    await expect(manager.getByRole('link', { name: /Tạo khu/ }), 'quản lý khu thấy nút Tạo khu').toHaveCount(0)
    await nav('/members')
    await expect(manager.getByRole('button', { name: 'Thêm quản lý khu' }), 'quản lý khu thấy nút Thêm quản lý khu').toHaveCount(0)

    // Thu tiền trên phiếu của khu mình: được; "Bỏ nợ": không có.
    await nav(`/invoices/${owing.id}`)
    await expect(manager.getByRole('button', { name: 'Đã thu' }).first()).toBeVisible()
    // Từ 08/11/2026 quản lý khu có quyền bỏ nợ như chủ trọ (không còn quyền cấp riêng) ⇒ nút Bỏ nợ phải hiện.
    await expect(manager.getByRole('button', { name: 'Bỏ nợ', exact: true }).first()).toBeVisible()
    await manager.getByRole('button', { name: 'Đã thu' }).first().click()
    await manager.locator('dialog[open]').last().getByRole('button', { name: 'Ghi thu', exact: true }).click()
    await expect(manager.getByText(/Đã ghi thu/).first()).toBeVisible({ timeout: 15_000 })
    await manager.screenshot({ path: 'test-results/prop9-3-manager-paid.png', fullPage: true })
    await context.close()
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
