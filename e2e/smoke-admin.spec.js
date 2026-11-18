import { expect, test } from '@playwright/test'

// SystemAdmin: đăng nhập lần đầu bị bắt đổi mật khẩu → danh sách tổ chức → tạo tổ chức (mật khẩu tạm hiện một lần) →
// tạm ngưng (chủ trọ đăng nhập bị chặn) → kích hoạt lại → cấp lại mật khẩu cho chủ trọ.
// Cần API khởi động với Bootstrap__Admin__Phone=0900000001, Bootstrap__Admin__Email=admin@rentingroom.local và
// Bootstrap__Admin__Password=<mật khẩu ≥ 12 ký tự> (đặt vào E2E_ADMIN_PASSWORD) trên DB vừa tạo. GHI dữ liệu — DB dùng một lần.
// Chạy: E2E_ADMIN_PASSWORD=... E2E_HEADLESS=1 npx playwright test e2e/smoke-admin.spec.js
const ADMIN = { username: process.env.E2E_ADMIN_USERNAME ?? '0900000001', password: process.env.E2E_ADMIN_PASSWORD }
const NEW_ADMIN_PASSWORD = 'MatKhauAdminMoi#2026'
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.skip(!ADMIN.password, 'Đặt E2E_ADMIN_PASSWORD (mật khẩu Bootstrap:Admin của DB test) để chạy spec này.')
test.use({ actionTimeout: 15_000 })
test.setTimeout(180_000)

async function go(page, to) {
  await page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, to)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

test('SystemAdmin: đổi mật khẩu lần đầu, tạo / tạm ngưng / kích hoạt lại tổ chức, cấp lại mật khẩu', async ({ page, browser }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/admin-${name}.png`, fullPage: true })
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
  const dialog = () => page.locator('dialog[open]').last()
  const main = () => page.locator('main')
  const unique = Date.now().toString().slice(-6)
  const orgCode = `UAT${unique}`
  const ownerPhone = `09${unique}77`
  let ownerPassword = ''

  await run('Đăng nhập lần đầu: bắt đổi mật khẩu', async () => {
    await page.goto('/login')
    await page.getByLabel('Số điện thoại hoặc email').fill(ADMIN.username)
    await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(ADMIN.password)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await page.waitForURL(/\/change-password/, { timeout: 15_000 })
    await shot('1-change-password')
    await page.getByLabel('Mật khẩu hiện tại').fill(ADMIN.password)
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill(NEW_ADMIN_PASSWORD)
    await page.getByLabel('Nhập lại mật khẩu mới').fill(NEW_ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Đặt mật khẩu mới' }).click()
    await expect(page).not.toHaveURL(/change-password/, { timeout: 15_000 })
  })

  await run('Danh sách tổ chức', async () => {
    await go(page, '/admin/organizations')
    await expect(main()).toContainText('DEMO')
    await shot('2-organizations')
  })

  await run('Tạo tổ chức mới', async () => {
    await page.getByRole('button', { name: 'Tạo tổ chức' }).first().click()
    await expect(dialog().getByText('Tạo tổ chức chủ trọ').first()).toBeVisible()
    await dialog().getByLabel('Mã tổ chức').fill(orgCode)
    await dialog().getByLabel('Tên tổ chức').fill(`Nhà trọ kiểm thử ${unique}`)
    await dialog().getByLabel('Họ tên chủ trọ').fill(`Chủ Trọ Kiểm Thử ${unique}`)
    await dialog().getByLabel('Số điện thoại').last().fill(ownerPhone)
    await shot('3-create-org')
    await dialog().locator('button[type="submit"]').click()
    // Mật khẩu tạm của chủ trọ chỉ hiện một lần. Chờ đúng hộp thoại kết quả (nút "Tôi đã lưu lại"): dòng mô tả của form tạo
    // cũng có chữ "Mật khẩu tạm" nên không dùng chữ đó để nhận biết.
    await expect(page.getByRole('button', { name: 'Tôi đã lưu lại' })).toBeVisible({ timeout: 15_000 })
    const text = await dialog().innerText()
    ownerPassword = (text.match(/Sao chép\s+Mật khẩu tạm\s+(\S+)/) ?? [])[1] ?? '' // nhãn "Mật khẩu tạm" của ô giá trị đi ngay sau nút Sao chép của ô Tên đăng nhập
    await shot('4-temp-password')
    await page.getByRole('button', { name: 'Tôi đã lưu lại' }).click()
    await expect(main()).toContainText(orgCode, { timeout: 10_000 })
  })

  await run('Tạm ngưng tổ chức → chủ trọ bị chặn đăng nhập', async () => {
    expect(ownerPassword, 'không đọc được mật khẩu tạm của chủ trọ').toBeTruthy()
    await go(page, '/admin/organizations')
    await page.locator('a', { hasText: orgCode }).first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Tạm ngưng', exact: true }).first().click()
    await dialog().getByRole('textbox').first().fill('Kiểm thử UAT')
    await dialog().getByRole('button', { name: 'Tạm ngưng', exact: true }).last().click()
    await expect(main()).toContainText(/Tạm ngưng|Suspended/i, { timeout: 10_000 })
    await shot('5-suspended')
    // Chủ trọ của tổ chức bị tạm ngưng không đăng nhập được.
    const context = await browser.newContext()
    const owner = await context.newPage()
    await owner.goto('/login')
    await owner.getByLabel('Số điện thoại hoặc email').fill(ownerPhone)
    await owner.getByRole('textbox', { name: 'Mật khẩu' }).fill(ownerPassword)
    await owner.getByRole('button', { name: 'Đăng nhập' }).click()
    await owner.waitForTimeout(2000)
    expect(owner.url(), 'chủ trọ của tổ chức tạm ngưng vẫn đăng nhập được').toMatch(/login/)
    await expect(owner.locator('body')).toContainText(/tạm ngưng/i)
    await context.close()
  })

  await run('Kích hoạt lại → chủ trọ bị bắt đổi mật khẩu tạm', async () => {
    await page.getByRole('button', { name: 'Kích hoạt lại', exact: true }).first().click()
    await dialog().getByRole('button', { name: 'Kích hoạt lại' }).last().click()
    await expect(main()).toContainText(/Hoạt động|Active/i, { timeout: 10_000 })
    const context = await browser.newContext()
    const owner = await context.newPage()
    await owner.goto('/login')
    await owner.getByLabel('Số điện thoại hoặc email').fill(ownerPhone)
    await owner.getByRole('textbox', { name: 'Mật khẩu' }).fill(ownerPassword)
    await owner.getByRole('button', { name: 'Đăng nhập' }).click()
    await owner.waitForURL(/\/change-password/, { timeout: 15_000 })
    await context.close()
  })

  await run('Cấp lại mật khẩu cho chủ trọ', async () => {
    await page.getByRole('button', { name: 'Cấp lại mật khẩu' }).first().click()
    await expect(page.getByText(/Mật khẩu tạm mới/).first()).toBeVisible({ timeout: 15_000 })
    await shot('6-reset-password')
    await page.getByRole('button', { name: 'Tôi đã lưu lại' }).click()
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
