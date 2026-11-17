import { expect, test } from '@playwright/test'

// Trình tạo hợp đồng 7 bước trên UI thật, gồm tạo NGƯỜI THUÊ MỚI ngay trong bước "Người thuê", lưu nháp rồi kích hoạt. GHI dữ liệu — DB seed dùng một lần.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-wizard.spec.js   (API :5213 vừa seed + UI :5173)
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

// E2E_MOBILE=1 ⇒ chạy cả wizard ở màn hình điện thoại 390×800.
if (process.env.E2E_MOBILE) test.use({ viewport: { width: 390, height: 800 } })
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

async function pickProperty(select, code) {
  const label = (await select.locator('option').allTextContents()).find((t) => t.trim().startsWith(`${code} ·`) || t.trim().startsWith(`${code} —`))
  if (!label) throw new Error(`không có khu ${code}`)
  await select.selectOption({ label })
}

/** Bước hiện tại của trình tạo (theo aria-current của thanh bước). */
const currentStep = (page) => page.locator('ol[aria-label="Các bước"] [aria-current="step"]').innerText().then((t) => t.replace(/^\d+\s*/, '').trim())

test('tạo hợp đồng: 7 bước + người thuê mới + lưu nháp + kích hoạt', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/wiz-${name}.png`, fullPage: true })
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
  /** Bấm Tiếp và xác nhận đã sang bước mong đợi; không sang được ⇒ báo lỗi hiện trên form. */
  const next = async (expected) => {
    await page.getByRole('button', { name: /^Tiếp/ }).click()
    await page.waitForTimeout(500)
    const now = await currentStep(page)
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

  const unique = Date.now().toString().slice(-8)
  const renterName = `Nguyễn Thị Kiểm Thử ${unique}`
  const idNumber = `0${unique}9999`.slice(0, 12).padEnd(12, '1')

  await run('Bước 1: Mẫu', async () => {
    await go(page, '/contracts/new')
    expect(await currentStep(page)).toBe('Mẫu')
    await shot('1-template')
    // Chọn rõ "Không dùng mẫu": spec khác có thể đã tạo mẫu có trường bắt buộc ở bước "Thông tin theo mẫu".
    const choice = page.locator('button[class*="choice"]', { hasText: 'Không dùng mẫu' }).first()
    if (await choice.count()) await choice.click()
    await next('Phòng')
  })

  await run('Bước 2: Phòng', async () => {
    await pickProperty(page.getByLabel('Khu'), 'A')
    const room = page.locator('button[class*="choice"]').first()
    await expect(room, 'khu A không có phòng trống để tạo hợp đồng').toBeVisible({ timeout: 10_000 })
    await room.click()
    await shot('2-room')
    await next('Người thuê')
  })

  await run('Bước 3: Người thuê mới', async () => {
    const picker = page.getByRole('combobox')
    await picker.fill('Nguyễn')
    await page.getByRole('button', { name: 'Thêm người thuê mới' }).click()
    await expect(dialog().getByText('Thêm người thuê').first()).toBeVisible()
    await dialog().getByLabel('Họ tên').fill(renterName)
    await dialog().getByLabel('Ngày sinh').fill('1995-05-20')
    await dialog().getByLabel('Giới tính').selectOption({ index: 1 })
    await dialog().getByLabel('Số điện thoại').fill(`09${unique}`)
    const idField = dialog().getByLabel(/Số CCCD|Số giấy tờ|CCCD/i).first()
    if (await idField.count()) await idField.fill(idNumber)
    await shot('3-renter-dialog')
    await dialog().getByRole('button', { name: /Lưu|Thêm/ }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByText(renterName).first()).toBeVisible()
    await shot('3-renter-chosen')
    await next('Điều khoản')
  })

  await run('Bước 4: Điều khoản', async () => {
    await shot('4-terms')
    await next('Khoản thu')
  })
  await run('Bước 5: Khoản thu', async () => {
    await shot('5-fees')
    await next('Thông tin theo mẫu')
  })
  await run('Bước 6: Thông tin theo mẫu', async () => {
    await shot('6-document')
    await next('Xem lại')
  })

  let contractUrl = ''
  await run('Bước 7: Lưu nháp', async () => {
    await shot('7-review')
    await page.getByRole('button', { name: 'Lưu nháp' }).click()
    await page.waitForURL(/\/contracts\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    contractUrl = page.url()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toContainText(/Nháp/, { timeout: 15_000 })
    await shot('8-draft')
  })

  await run('Kích hoạt hợp đồng nháp', async () => {
    expect(contractUrl, 'chưa lưu được nháp').toBeTruthy()
    await page.getByRole('button', { name: 'Kích hoạt' }).first().click()
    await expect(dialog()).toBeVisible()
    await page.waitForTimeout(800)
    // Chỉ số nhận phòng: điền sẵn bằng số mới nhất nếu ô còn trống.
    const inputs = dialog().locator('input[inputmode="decimal"], input[type="text"]:not([maxlength])')
    for (let i = 0; i < (await inputs.count()); i++) {
      const input = inputs.nth(i)
      if ((await input.inputValue()) !== '') continue
      const text = await input.locator('xpath=ancestor::*[contains(., "Mới nhất")][1]').innerText().catch(() => '')
      const m = text.match(/Mới nhất:\s*([\d.]+(?:,\d+)?)/)
      if (m) await input.fill(m[1].replace(/\./g, ''))
    }
    await shot('9-activate-dialog')
    await dialog().getByRole('button', { name: /Kích hoạt/ }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toContainText(/Đang hiệu lực/, { timeout: 15_000 })
    await shot('10-active')
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
