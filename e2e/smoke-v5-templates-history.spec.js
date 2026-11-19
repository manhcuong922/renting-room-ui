import { expect, test } from '@playwright/test'

// Mẫu hợp đồng: tạo → sửa tên → ngừng dùng → khôi phục; Lịch sử thuê: tìm theo tên không dấu. GHI dữ liệu — DB seed dùng một lần.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-v5-templates-history.spec.js   (API :5213 vừa seed + UI :5173)
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.use({ actionTimeout: 15_000 })
test.setTimeout(150_000)

async function go(page, to) {
  await page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, to)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

test('mẫu hợp đồng: sửa, ngừng dùng, khôi phục; lịch sử thuê: tìm không dấu', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/tpl-${name}.png`, fullPage: true })
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
  const name1 = `Mẫu thử ${unique}`
  const name2 = `Mẫu thử đã đổi tên ${unique}`

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  await run('Mẫu: tạo từ mẫu gợi ý', async () => {
    await go(page, '/contract-templates')
    await page.getByRole('button', { name: 'Tạo mẫu' }).click()
    await dialog().locator('button[class*="preset"]').first().click()
    await page.waitForURL(/\/contract-templates\/new/, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Tên mẫu').fill(name1)
    await page.getByRole('button', { name: 'Tạo mẫu', exact: true }).click()
    await page.waitForURL(/\/contract-templates\/[0-9a-f-]{36}/, { timeout: 15_000 })
  })

  await run('Mẫu: sửa tên và lưu', async () => {
    // Chờ form nạp xong dữ liệu mẫu (giá trị cũ hiện ra) rồi mới sửa — điền sớm hơn thì dữ liệu nạp sau đè mất chữ vừa gõ (WebKit chậm hơn).
    await expect(page.getByLabel('Tên mẫu')).toHaveValue(name1, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500) // WebKit: URL đổi trước khi React vẽ xong trang mới ⇒ gõ sớm là gõ vào form cũ, rồi bị thay mới
    await page.getByLabel('Tên mẫu').fill(name2)
    await expect(page.getByLabel('Tên mẫu')).toHaveValue(name2)
    await page.getByRole('button', { name: 'Lưu mẫu' }).click()
    await expect(page.getByText(/Đã lưu|đã cập nhật|Đã cập nhật/i).first()).toBeVisible({ timeout: 15_000 })
    await go(page, '/contract-templates')
    await expect(main()).toContainText(name2, { timeout: 10_000 })
    await expect(main()).not.toContainText(name1)
  })

  await run('Mẫu: ngừng dùng → biến mất khỏi danh sách (và bước chọn mẫu của wizard)', async () => {
    await page.locator('a', { hasText: name2 }).first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Ngừng dùng' }).click()
    await dialog().getByRole('button', { name: 'Ngừng dùng' }).last().click()
    await expect(page.getByRole('button', { name: 'Khôi phục' })).toBeVisible({ timeout: 10_000 })
    await go(page, '/contracts/new')
    await expect(page.locator('button[class*="choice"]', { hasText: name2 }), 'mẫu đã ngừng dùng vẫn hiện trong wizard').toHaveCount(0)
  })

  await run('Mẫu: khôi phục → dùng lại được trong wizard', async () => {
    await go(page, '/contract-templates')
    const archived = page.getByRole('checkbox', { name: /ngừng dùng|đã ngừng/i })
    if (await archived.count()) {
      await archived.click() // ô lọc đổi tham số URL rồi mới vẽ lại ⇒ không dùng check() (kiểm trạng thái ngay)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
    }
    await page.locator('a', { hasText: name2 }).first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Khôi phục' }).click()
    await dialog().getByRole('button', { name: 'Khôi phục' }).last().click()
    await expect(page.getByRole('button', { name: 'Ngừng dùng' })).toBeVisible({ timeout: 10_000 })
    await go(page, '/contracts/new')
    await expect(page.locator('button[class*="choice"]', { hasText: name2 })).toBeVisible({ timeout: 10_000 })
  })

  await run('Lịch sử thuê: tìm theo tên không dấu', async () => {
    await go(page, '/tenancy-history')
    await page.getByLabel('Tìm theo họ tên').fill('to')
    await page.waitForTimeout(1200)
    const before = await main().innerText()
    await page.getByLabel('Tìm theo họ tên').fill('tô thị')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)
    await shot('1-tenancy-search')
    const text = await main().innerText()
    expect(text, 'tìm "tô thị" không ra ai (kỳ vọng có Tô Thị Hạnh / Tô Thị Mai)').toMatch(/Tô Thị/)
    await page.getByLabel('Tìm theo họ tên').fill('to thi')
    await expect.poll(async () => await main().innerText(), { timeout: 10_000, message: 'gõ không dấu "to thi" không ra kết quả giống có dấu' }).toMatch(/Tô Thị/)
    void before
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
