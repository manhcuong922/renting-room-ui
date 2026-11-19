import { expect, test } from '@playwright/test'

// Còn lại (UI thật): lắp công tơ hàng loạt, hủy một chỉ số (phiếu còn nháp), sửa hồ sơ người thuê + ẩn / hiện lại hồ sơ,
// thu tiền theo hợp đồng, xuất người thuê theo khu, "Đã gửi lại" cho phiếu cần gửi lại. GHI dữ liệu — chỉ chạy trên DB seed dùng một lần.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-v8-meters-renters-misc.spec.js   (API :5213 vừa seed + UI :5173)
const API = process.env.E2E_API_URL ?? 'http://localhost:5213/api/v1'
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
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

test('công tơ hàng loạt, hủy chỉ số, hồ sơ người thuê, thu theo hợp đồng, xuất theo khu, gửi lại phiếu', async ({ page, request }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (400|401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/misc8-${name}.png`, fullPage: true })
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
  const toast = (re) => expect(page.getByText(re).first()).toBeVisible({ timeout: 15_000 })
  const unique = Date.now().toString().slice(-6)

  const token = (await (await request.post(`${API}/auth/login`, { data: { username: OWNER.phone, password: OWNER.password } })).json()).accessToken
  const get = async (path) => (await (await request.get(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })).json()).items
  const resend = (await get('/invoices?pageSize=100&needsResend=true'))[0]
  const gone = (await get('/renters?pageSize=100&staying=false')).filter((r) => !r.anonymizedAt && !r.archivedAt)[0]

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  const openContract = async (no) => {
    await go(page, '/contracts')
    await page.getByLabel('Tìm số hợp đồng').fill(no)
    await page.waitForTimeout(900)
    await page.locator(`a[href^="/contracts/"]:has-text("${no}"):visible`).first().click()
    await page.waitForLoadState('networkidle')
    await expect(main()).toContainText(no)
    await page.waitForTimeout(600)
  }

  // ------------------------------------------------------------- Lắp công tơ hàng loạt
  await run('Lắp công tơ nước hàng loạt (phòng chưa có công tơ nước)', async () => {
    await go(page, '/properties')
    await page.locator('a[href^="/properties/"]:not([href="/properties/new"])').filter({ hasText: /Khu A|^A\b/ }).first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: 'Công tơ', exact: true }).click()
    await page.waitForLoadState('networkidle')
    await page.locator('label', { hasText: /Lắp hàng loạt/ }).click()
    await page.waitForTimeout(600)
    const fee = page.getByLabel('Khoản thu').first()
    // Đọc nhãn option bằng evaluate: locator('option') trên ô này làm Firefox (Playwright) crash cả trang.
    const water = (await fee.evaluate((el) => [...el.options].map((o) => o.textContent))).find((t) => /Nước/.test(t))
    if (water) await fee.selectOption({ label: water })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)
    const serial = page.locator('input[aria-label^="Serial phòng"]:visible').first() // bảng và thẻ mobile cùng có trong DOM
    await expect(serial, 'không có phòng nào thiếu công tơ nước để lắp').toBeVisible({ timeout: 10_000 })
    const room = (await serial.getAttribute('aria-label')).replace('Serial phòng ', '')
    await serial.fill(`W-BULK-${unique}`)
    await page.locator(`input[aria-label="Chỉ số ban đầu phòng ${room}"]:visible`).fill('0')
    await shot('1-bulk-install')
    await page.getByRole('button', { name: /^Lắp \d+ công tơ$/ }).click()
    await toast(/Đã lắp|đã lắp|Đã lưu/i)
  })

  // ------------------------------------------------------------- Hủy chỉ số
  await run('Hủy một chỉ số cuối kỳ của phòng 103 (phiếu còn nháp)', async () => {
    await go(page, '/rooms')
    await page.getByLabel('Tìm phòng').fill('103')
    await page.waitForTimeout(900)
    await page.locator('a[href^="/rooms/"]:has-text("103"):visible').first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Lịch sử' }).first().click()
    await expect(dialog().getByText(/Lịch sử chỉ số/).first()).toBeVisible()
    await shot('2-history')
    const voidButton = dialog().getByRole('button', { name: 'Hủy', exact: true }).first()
    await expect(voidButton, 'phòng 103 không có chỉ số nào hủy được').toBeVisible()
    await voidButton.click()
    // Hộp thoại xác nhận mở chồng lên hộp thoại lịch sử ⇒ lấy hộp thoại trên cùng.
    await expect(dialog().getByText('Hủy chỉ số?').first()).toBeVisible()
    const box = dialog().getByRole('textbox').first()
    if (await box.count()) await box.fill('Ghi nhầm (test UAT)')
    await dialog().getByRole('button', { name: 'Hủy chỉ số' }).click()
    await toast(/Đã hủy|đã hủy/i)
  })

  // ------------------------------------------------------------- Người thuê: sửa + ẩn / hiện lại
  await run('Người thuê: sửa hồ sơ', async () => {
    expect(gone, 'không có người thuê đã chuyển đi').toBeTruthy()
    await go(page, `/renters/${gone.id}`)
    await page.getByRole('button', { name: 'Sửa hồ sơ' }).click()
    await expect(dialog().getByText(/Sửa hồ sơ/).first()).toBeVisible()
    await dialog().getByLabel('Nghề nghiệp').fill(`Kỹ sư kiểm thử ${unique}`)
    await shot('3-renter-edit')
    await dialog().locator('button[type="submit"]').click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(`Kỹ sư kiểm thử ${unique}`, { timeout: 10_000 })
  })

  await run('Người thuê: ẩn hồ sơ → hiện lại', async () => {
    await page.getByRole('button', { name: 'Ẩn hồ sơ', exact: true }).first().click()
    await page.locator('dialog[open]').filter({ hasText: /Ẩn hồ sơ/ }).getByRole('button', { name: 'Ẩn hồ sơ' }).last().click()
    await expect(page.getByRole('button', { name: /Hiện lại|Khôi phục/ }).first()).toBeVisible({ timeout: 15_000 })
    await shot('4-renter-archived')
    await page.getByRole('button', { name: /Hiện lại|Khôi phục/ }).first().click()
    const confirm = page.locator('dialog[open]')
    if (await confirm.count()) await confirm.last().getByRole('button', { name: /Hiện lại|Khôi phục/ }).last().click()
    await expect(page.getByRole('button', { name: 'Ẩn hồ sơ', exact: true }).first()).toBeVisible({ timeout: 15_000 })
  })

  // ------------------------------------------------------------- Thu theo hợp đồng
  await run('Thu tiền theo hợp đồng (A·102 đang nợ)', async () => {
    await openContract('HD2026-0002')
    await page.getByRole('button', { name: 'Thu tiền' }).first().click()
    // "Thu tiền" mở hộp thoại công nợ (từng phiếu nợ + nút "Thu theo hợp đồng"); form thu tiền mở chồng lên.
    await expect(dialog().getByText(/còn nợ/).first()).toBeVisible()
    await shot('5a-contract-balance')
    await dialog().getByRole('button', { name: 'Thu theo hợp đồng' }).click()
    await expect(dialog().getByLabel('Số tiền thu')).toBeVisible()
    await dialog().getByLabel('Số tiền thu').fill('500000')
    await shot('5-contract-payment')
    await dialog().getByRole('button', { name: 'Ghi thu', exact: true }).click()
    await toast(/Đã ghi thu|đã ghi thu|Đã thu/i)
    await page.keyboard.press('Escape')
  })

  // ------------------------------------------------------------- Xuất người thuê theo khu
  await run('Xuất người thuê theo khu A (Excel)', async () => {
    await go(page, '/properties')
    await page.locator('a[href^="/properties/"]:not([href="/properties/new"])').filter({ hasText: /Khu A|^A\b/ }).first().click()
    // Trang danh sách khu cũng có nút "Xuất người thuê": chờ sang hẳn trang chi tiết khu (WebKit chuyển trang chậm ở chế độ dev).
    await page.waitForURL(/\/properties\/[0-9a-f-]{36}/, { timeout: 15_000 })
    await expect(page.getByRole('tab', { name: 'Phòng', exact: true })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Xuất người thuê' }).click()
    await expect(dialog()).toBeVisible()
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), dialog().getByRole('button', { name: /^Xuất/ }).last().click()])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i)
  })

  // ------------------------------------------------------------- Gửi lại phiếu
  await run('Phiếu "Cần gửi lại" → Đã gửi lại', async () => {
    expect(resend, 'seed không có phiếu cần gửi lại').toBeTruthy()
    await go(page, `/invoices/${resend.id}`)
    await page.getByRole('button', { name: 'Đã gửi lại' }).click()
    await toast(/Đã ghi nhận gửi lại/)
    await expect(page.getByRole('button', { name: 'Đã gửi lại' })).toHaveCount(0, { timeout: 10_000 })
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
