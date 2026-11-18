import { expect, test } from '@playwright/test'

// "Cho ở tiếp, chưa ký lại": tạo qua wizard một hợp đồng đã QUÁ HẠN (bắt đầu 80 ngày trước, hết hạn 5 ngày trước), kích hoạt,
// rồi chọn "Cho ở tiếp" ⇒ hợp đồng thành không thời hạn, ghi rõ "ở tiếp từ…" và hạn cũ. GHI dữ liệu — DB seed dùng một lần.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-holdover.spec.js   (API :5213 vừa seed + UI :5173)
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.use({ actionTimeout: 15_000 })
test.setTimeout(180_000)

const isoPlusDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

async function go(page, to) {
  await page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, to)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

test('cho ở tiếp hợp đồng quá hạn', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/holdover-${name}.png`, fullPage: true })
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
  const unique = Date.now().toString().slice(-8)
  const currentStep = () => page.locator('ol[aria-label="Các bước"] [aria-current="step"]').innerText().then((t) => t.replace(/^\d+\s*/, '').trim())
  const next = async (expected) => {
    await page.getByRole('button', { name: /^Tiếp/ }).click()
    await page.waitForTimeout(500)
    const now = await currentStep()
    if (now !== expected) {
      const errors = await page.locator('[role="alert"], [class*="error" i]').allInnerTexts()
      throw new Error(`kẹt ở bước "${now}" (mong đợi "${expected}"): ${errors.join(' / ').replace(/\s+/g, ' ').slice(0, 300)}`)
    }
  }

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  let contractUrl = ''
  await run('Tạo hợp đồng quá hạn bằng wizard', async () => {
    await go(page, '/contracts/new')
    const none = page.locator('button[class*="choice"]', { hasText: 'Không dùng mẫu' }).first()
    if (await none.count()) await none.click()
    await next('Phòng')
    const property = page.getByLabel('Khu')
    const label = (await property.locator('option').allTextContents()).find((t) => t.trim().startsWith('A ·'))
    await property.selectOption({ label })
    // Phòng trống cuối danh sách (tránh phòng các spec khác hay dùng).
    const rooms = page.locator('button[class*="choice"]', { hasText: 'Trống' })
    await expect(rooms.first()).toBeVisible({ timeout: 10_000 })
    await rooms.last().click()
    await next('Người thuê')
    await page.getByRole('combobox').fill('Nguyễn')
    await page.getByRole('button', { name: 'Thêm người thuê mới' }).click()
    await dialog().getByLabel('Họ tên').fill(`Trần Quá Hạn ${unique}`)
    await dialog().getByLabel('Ngày sinh').fill('1990-03-15')
    await dialog().getByLabel('Giới tính').selectOption({ index: 1 })
    await dialog().getByLabel('Số điện thoại').fill(`09${unique.slice(0, 8)}`)
    await dialog().getByLabel(/Số CCCD|CCCD/i).first().fill(`0${unique}9${unique.slice(-3)}`.slice(0, 12).padEnd(12, '3'))
    await dialog().getByRole('button', { name: /Lưu|Thêm/ }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await next('Điều khoản')
    await page.getByLabel('Ngày bắt đầu').fill(isoPlusDays(-80)) // sau hợp đồng cũ của phòng (kết thúc ~95 ngày trước) — CT-BR-01 cấm trùng thời gian
    await page.getByLabel('Ngày kết thúc').fill(isoPlusDays(-5))
    await shot('1-terms')
    await next('Khoản thu')
    await next('Thông tin theo mẫu')
    await next('Xem lại')
    await page.getByRole('button', { name: 'Lưu nháp' }).click()
    await page.waitForURL(/\/contracts\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    contractUrl = page.url()
  })

  await run('Kích hoạt hợp đồng quá hạn', async () => {
    expect(contractUrl, 'chưa tạo được hợp đồng').toBeTruthy()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Kích hoạt' }).first().click()
    await expect(dialog()).toBeVisible()
    await page.waitForTimeout(800)
    // Chỉ số nhận phòng: điền số "Mới nhất" nếu ô còn trống.
    const inputs = dialog().locator('input[inputmode="decimal"], input[type="text"]:not([maxlength])')
    for (let i = 0; i < (await inputs.count()); i++) {
      const input = inputs.nth(i)
      if ((await input.inputValue()) !== '') continue
      const text = await input.locator('xpath=ancestor::*[contains(., "Mới nhất")][1]').innerText().catch(() => '')
      const m = text.match(/Mới nhất:\s*([\d.]+(?:,\d+)?)/)
      if (m) await input.fill(m[1].replace(/\./g, ''))
    }
    await dialog().getByRole('button', { name: /Kích hoạt/ }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 20_000 })
    await expect(main()).toContainText(/Đang hiệu lực/, { timeout: 10_000 })
    await shot('2-active-expired')
  })

  await run('Hợp đồng hiện nhãn quá hạn + các lựa chọn', async () => {
    await expect(main()).toContainText(/Hết hạn|quá hạn/i)
    for (const name of ['Gia hạn', /Cho ở tiếp/, /Thu lại phòng/]) await expect(page.getByRole('button', { name }).first()).toBeVisible()
  })

  await run('Cho ở tiếp, chưa ký lại', async () => {
    await page.getByRole('button', { name: /Cho ở tiếp/ }).first().click()
    await expect(dialog().getByText('Cho ở tiếp, chưa ký lại')).toBeVisible()
    await dialog().getByLabel('Ghi chú').fill('Hẹn ký lại cuối tháng (test UAT)')
    await shot('3-holdover-dialog')
    await dialog().getByRole('button', { name: 'Ghi nhận ở tiếp' }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(/ở tiếp từ/, { timeout: 10_000 })
    await expect(main()).toContainText(/Không thời hạn/)
    await shot('4-holdover-done')
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
