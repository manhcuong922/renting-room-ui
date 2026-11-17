import { expect, test } from '@playwright/test'

// Gia hạn hợp đồng hết hạn, ký lại cho người còn ở, rồi sửa hợp đồng nháp vừa sinh ra. GHI dữ liệu — DB seed dùng một lần.
// Dùng HĐ của dữ liệu demo: A·202 (HD2026-0008, hết hạn chờ quyết định) và A·104 (HD2026-0004, 2 người ở).
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-renew-resign.spec.js   (API :5213 vừa seed + UI :5173)
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.use({ actionTimeout: 15_000 })
test.setTimeout(180_000)

async function go(page, path) {
  await page.evaluate((to) => {
    history.pushState({}, '', to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

const isoPlusDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

test('gia hạn, ký lại, sửa nháp', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/rr-${name}.png`, fullPage: true })
  const run = async (name, fn) => {
    step = name
    try {
      await fn()
    } catch (e) {
      issues.push(`[${name}] ${String(e.message).split('\n').slice(0, 5).join(' | ').slice(0, 500)}`)
      await shot(`fail-${name.replace(/\W+/g, '_').slice(0, 30)}`).catch(() => {})
      await page.keyboard.press('Escape').catch(() => {})
    }
  }
  const dialog = () => page.locator('dialog[open]')
  const main = () => page.locator('main')

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
  }

  await run('Gia hạn HD2026-0008 (hết hạn chờ quyết định)', async () => {
    await openContract('HD2026-0008')
    await shot('0-expired')
    const extend = page.getByRole('button', { name: 'Gia hạn', exact: true }).first()
    await extend.waitFor({ timeout: 8_000 })
    await extend.click()
    await expect(dialog().getByText('Gia hạn hợp đồng')).toBeVisible()
    const newEnd = isoPlusDays(365)
    await dialog().getByLabel('Ngày kết thúc mới').fill(newEnd)
    await shot('1-extend-dialog')
    await dialog().getByRole('button', { name: 'Gia hạn', exact: true }).click()
    await expect(page.getByText('Đã gia hạn hợp đồng.').first()).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    // Hết hạn chờ quyết định ⇒ sau gia hạn không còn nhãn / banner quá hạn.
    await expect(main()).not.toContainText(/Hết hạn — chờ quyết định|Hết hạn chờ quyết định/)
    await shot('2-extended')
  })

  let draftUrl = ''
  await run('Ký lại HD2026-0004 cho người còn ở', async () => {
    await openContract('HD2026-0004')
    const resign = page.getByRole('button', { name: /Ký lại/ }).first()
    await resign.waitFor({ timeout: 8_000 })
    await resign.click()
    await expect(dialog().getByText(/Ký lại/).first()).toBeVisible()
    await page.waitForTimeout(600)
    const newHead = dialog().getByLabel('Người đứng tên mới')
    const options = await newHead.locator('option:not([value=""])').count()
    expect(options, 'không có người ở nào khác để đứng tên hợp đồng mới').toBeGreaterThan(0)
    await newHead.selectOption(await newHead.locator('option:not([value=""])').first().getAttribute('value'))
    await dialog().getByLabel('Ngày bàn giao').fill(isoPlusDays(0))
    await shot('3-resign-dialog')
    await dialog().getByRole('button', { name: 'Ký lại', exact: true }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 20_000 })
    await page.waitForLoadState('networkidle')
    await shot('4-after-resign')
    // Ký lại xong app tự mở trang SỬA NHÁP của hợp đồng mới ("khai lại quan hệ người ở rồi kích hoạt").
    await page.waitForURL(/\/contracts\/[0-9a-f-]{36}\/edit$/, { timeout: 20_000 })
    draftUrl = page.url()
  })

  await run('Sửa hợp đồng nháp vừa ký lại', async () => {
    expect(draftUrl, 'chưa tới trang sửa nháp của hợp đồng mới').toMatch(/\/edit$/)
    await page.waitForLoadState('networkidle')
    await page.getByRole('heading', { name: /Sửa nháp/ }).waitFor({ timeout: 10_000 })
    const goNext = async (expected) => {
      await page.getByRole('button', { name: /^Tiếp/ }).click()
      await page.waitForTimeout(500)
      const now = await page.locator('ol[aria-label="Các bước"] [aria-current="step"]').innerText().then((t) => t.replace(/^\d+\s*/, '').trim())
      if (now !== expected) {
        const errors = await page.locator('[role="alert"], [class*="error" i]').allInnerTexts()
        throw new Error(`kẹt ở bước "${now}" (mong đợi "${expected}"): ${errors.join(' / ').replace(/\s+/g, ' ').slice(0, 300)}`)
      }
    }
    // Hợp đồng nháp sau ký lại bắt đầu ở bước đầu — đi tuần tự tới "Xem lại".
    const start = await page.locator('ol[aria-label="Các bước"] [aria-current="step"]').innerText().then((t) => t.replace(/^\d+\s*/, '').trim())
    const order = ['Mẫu', 'Phòng', 'Người thuê', 'Điều khoản', 'Khoản thu', 'Thông tin theo mẫu', 'Xem lại']
    for (const name of order.slice(order.indexOf(start) + 1)) {
      if (name === 'Xem lại') await shot('5-before-review')
      await goNext(name)
    }
    await shot('6-review')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await page.waitForURL(/\/contracts\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    await expect(main()).toContainText(/Nháp/, { timeout: 10_000 })
    await shot('7-saved')
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
