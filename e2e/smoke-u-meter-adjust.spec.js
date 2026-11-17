import { expect, test } from '@playwright/test'

// Điều chỉnh chỉ số ĐÃ CHỐT (MT-UC-09) trên UI thật: phòng A·101 có phiếu đã chốt + đã thu; gõ dư chỉ số cuối thì chỉnh lại, phần chênh
// "đẩy sang hóa đơn sau". GHI dữ liệu — chỉ chạy trên DB seed dùng một lần.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-u-meter-adjust.spec.js   (API :5213 vừa seed + UI :5173)
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.use({ actionTimeout: 15_000 })
test.setTimeout(120_000)

async function go(page, to) {
  await page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, to)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

test('điều chỉnh chỉ số đã chốt của phòng 101', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/meter-${name}.png`, fullPage: true })
  const dialogs = () => page.locator('dialog[open]')
  const topDialog = () => dialogs().last()

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  step = 'Mở chi tiết phòng 101'
  try {
    await go(page, '/rooms')
    await page.getByLabel('Tầng').fill('1')
    await page.waitForTimeout(900)
    await page.locator('a[href^="/rooms/"]:has-text("101"):visible').first().click()
    await page.waitForLoadState('networkidle')

    step = 'Lịch sử chỉ số điện'
    await page.getByRole('button', { name: 'Lịch sử' }).first().click()
    await expect(topDialog().getByText(/Lịch sử chỉ số/).first()).toBeVisible()
    await shot('1-history')

    step = 'Điều chỉnh chỉ số đã chốt'
    // Chỉ số đã dùng cho phiếu đã chốt: bấm "Sửa" ⇒ nhập số mới ⇒ app chuyển sang "Điều chỉnh chỉ số đã chốt" (giữ số vừa nhập).
    // Dòng chỉ số cuối tháng trước (01/11) đã dùng cho phiếu đã chốt ⇒ bị khóa. Chọn đúng dòng đó (dòng mới nhất có thể là số chưa chốt do spec khác ghi).
    await topDialog().locator('tr', { hasText: '01/11/2026' }).getByRole('button', { name: 'Sửa', exact: true }).click()
    const editDialog = dialogs().filter({ hasText: 'Sửa chỉ số' }).last()
    await expect(editDialog).toBeVisible()
    const editValue = editDialog.getByLabel(/^Chỉ số/)
    const current = Number((await editValue.inputValue()).replace(/\./g, '').replace(',', '.')) || 0
    expect(current, 'không đọc được chỉ số hiện tại').toBeGreaterThan(0)
    await editValue.fill(String(current - 3).replace('.', ','))
    await editDialog.getByRole('button', { name: 'Lưu', exact: true }).click()
    const adjustDialog = dialogs().filter({ hasText: 'Điều chỉnh chỉ số đã chốt' }).last()
    await expect(adjustDialog, 'sửa chỉ số đã chốt không chuyển sang hộp thoại điều chỉnh').toBeVisible({ timeout: 10_000 })
    await expect(adjustDialog.getByLabel('Chỉ số đúng')).toHaveValue(/\d/)
    await adjustDialog.getByLabel('Lý do').fill('Gõ dư 3 kWh (test UAT)')
    // Hóa đơn đã thu tiền ⇒ bắt buộc chọn cách xử lý phần chênh (mặc định "Tự chọn" bị server từ chối 400).
    await adjustDialog.getByText('Đẩy sang hóa đơn sau', { exact: true }).click()
    await shot('2-adjust-dialog')
    await adjustDialog.getByRole('button', { name: 'Điều chỉnh', exact: true }).click()
    // Thành công ⇒ form điều chỉnh đóng và lịch sử hiện số mới kèm lý do; bị từ chối ⇒ form còn mở với lời giải thích.
    await expect(adjustDialog.getByLabel('Chỉ số đúng'), 'điều chỉnh không thành công — form còn mở').toHaveCount(0, { timeout: 15_000 })
    const expected = new Intl.NumberFormat('vi-VN').format(current - 3)
    await expect(topDialog()).toContainText(expected)
    await expect(topDialog()).toContainText('Gõ dư 3 kWh (test UAT)')
    await shot('3-adjusted')
  } catch (e) {
    issues.push(`[${step}] ${String(e.message).split('\n').slice(0, 5).join(' | ').slice(0, 600)}`)
    await shot('fail').catch(() => {})
  }

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
