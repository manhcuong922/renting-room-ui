import { expect, test } from '@playwright/test'

// Khoản thu & phòng, các nhánh còn lại (UI thật): bảng giá (thêm → xóa), "Phòng đang dùng" (gắn / gỡ hàng loạt), sao chép khoản thu từ khu khác;
// phòng: sửa, bảo trì → kết thúc bảo trì, ngừng sử dụng → khôi phục. GHI dữ liệu — chỉ chạy trên DB seed dùng một lần.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-v7-fees-rooms.spec.js   (API :5213 vừa seed + UI :5173)
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

const isoToday = () => new Date().toISOString().slice(0, 10)

test('khoản thu: bảng giá, phòng đang dùng, sao chép; phòng: sửa, bảo trì, ngừng dùng', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (400|401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/fee7-${name}.png`, fullPage: true })
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
  const rowOf = (text, button) =>
    page.locator('tr:visible, li:visible, article:visible').filter({ hasText: text }).filter({ has: page.getByRole('button', { name: button }) }).last()

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  const openPropertyTab = async (code, tab) => {
    await go(page, '/properties')
    await page.locator('a[href^="/properties/"]:not([href="/properties/new"])').filter({ hasText: new RegExp(`Khu ${code}|^${code}\\b`) }).first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
  }

  // ------------------------------------------------------------- Bảng giá
  await run('Bảng giá Wifi: thêm giá mới → xóa', async () => {
    await openPropertyTab('A', 'Khoản thu')
    await rowOf('Wifi', 'Bảng giá').getByRole('button', { name: 'Bảng giá' }).click()
    await expect(dialog().getByText('Bảng giá — Wifi').first()).toBeVisible()
    await shot('1-prices-dialog')
    await dialog().getByRole('button', { name: /Thêm (bản )?giá/ }).first().click()
    await dialog().getByLabel('Hiệu lực từ ngày').fill(isoToday())
    await dialog().getByLabel('Đơn giá').fill('130000')
    await dialog().locator('button[type="submit"]').click()
    // Khoản dịch vụ có người đang thuê: hỏi có áp giá mới cho họ không.
    const apply = page.locator('dialog[open]').filter({ hasText: 'Áp giá mới cho người đang thuê?' })
    await page.waitForTimeout(1500)
    if (await apply.count()) {
      await shot('2-apply-new-price')
      await apply.getByRole('button').last().click()
      await page.waitForTimeout(1500)
    }
    await expect(dialog()).toContainText('130.000', { timeout: 10_000 })
    await dialog().getByRole('button', { name: /Xóa/ }).first().click()
    await page.locator('dialog[open]').filter({ hasText: 'Xóa bản giá?' }).getByRole('button', { name: 'Xóa bản giá' }).click()
    await expect(dialog()).not.toContainText('130.000', { timeout: 10_000 })
    await dialog().getByRole('button', { name: 'Đóng' }).last().click()
  })

  await run('Phòng đang dùng Rác: chọn phòng → gắn / gỡ hàng loạt', async () => {
    await openPropertyTab('A', 'Khoản thu')
    await rowOf('Rác', 'Phòng đang dùng').getByRole('button', { name: 'Phòng đang dùng' }).click()
    await expect(dialog().getByText('Phòng đang dùng — Rác').first()).toBeVisible()
    await page.waitForTimeout(800)
    await shot('3-fee-usage')
    const boxes = dialog().getByRole('checkbox')
    expect(await boxes.count(), 'không có phòng nào để chọn').toBeGreaterThan(0)
    await boxes.first().check()
    // Các phòng đang dùng khoản này được chọn sẵn ⇒ "Bớt cho N phòng" gỡ khoản khỏi các phòng đó.
    await dialog().getByRole('button', { name: /Bớt cho [1-9]\d* phòng/ }).click()
    await page.waitForTimeout(2000)
    await toast(/Đã bớt|đã bớt|Đã cập nhật|bớt/i)
    await page.keyboard.press('Escape')
  })

  await run('Sao chép khoản thu từ khu A sang khu D', async () => {
    await openPropertyTab('D', 'Khoản thu')
    await page.getByRole('button', { name: 'Sao chép từ khu khác' }).click()
    await expect(dialog().getByText('Sao chép khoản thu từ khu khác').first()).toBeVisible()
    const source = dialog().getByLabel('Khu nguồn')
    const label = (await source.locator('option').allTextContents()).find((t) => /^A\b/.test(t.trim()))
    await source.selectOption({ label })
    await page.waitForTimeout(800)
    await dialog().getByLabel('Giá hiệu lực từ ngày').fill(isoToday()).catch(() => {})
    await shot('4-copy-fees')
    await dialog().getByRole('button', { name: 'Sao chép', exact: true }).click()
    await page.waitForTimeout(2000)
    // Khu D đã có khoản cùng tên ⇒ server có thể báo trùng; bị từ chối phải có lời giải thích trong hộp thoại, thành công thì đóng.
    if (await page.locator('dialog[open]').count()) {
      const text = (await dialog().innerText()).replace(/\s+/g, ' ')
      expect(text, 'sao chép không đóng hộp thoại và cũng không giải thích').toMatch(/trùng|đã có|không|Không/)
      await page.keyboard.press('Escape')
    }
  })

  // ------------------------------------------------------------- Phòng
  await run('Phòng 106: sửa giá niêm yết', async () => {
    await go(page, '/rooms')
    await page.getByLabel('Tìm phòng').fill('106')
    await page.waitForTimeout(900)
    await page.locator('a[href^="/rooms/"]:has-text("106"):visible').first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Sửa', exact: true }).first().click()
    await expect(dialog().getByText('Sửa phòng 106').first()).toBeVisible()
    await dialog().getByLabel(/Giá niêm yết/).fill('3250000')
    await shot('5-room-edit')
    await dialog().locator('button[type="submit"]').click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText('3.250.000', { timeout: 10_000 })
  })

  await run('Phòng 106: bảo trì → kết thúc bảo trì', async () => {
    await page.getByRole('button', { name: 'Bảo trì', exact: true }).first().click()
    const box = dialog().getByRole('textbox').first()
    if (await box.count()) await box.fill('Sơn lại tường (test UAT)')
    await dialog().getByRole('button', { name: 'Bắt đầu bảo trì' }).click()
    await expect(page.getByRole('button', { name: /Kết thúc bảo trì/ }).first()).toBeVisible({ timeout: 15_000 })
    await expect(main()).toContainText(/Bảo trì/)
    await page.getByRole('button', { name: /Kết thúc bảo trì/ }).first().click()
    await dialog().getByRole('button', { name: 'Kết thúc bảo trì' }).last().click()
    await expect(page.getByRole('button', { name: 'Bảo trì', exact: true }).first()).toBeVisible({ timeout: 15_000 })
  })

  await run('Phòng 106: ngừng sử dụng → khôi phục', async () => {
    await page.getByRole('button', { name: 'Ngừng dùng' }).first().click()
    await dialog().getByRole('button', { name: 'Ngừng sử dụng' }).last().click()
    await expect(page.getByRole('button', { name: 'Khôi phục' }).first()).toBeVisible({ timeout: 15_000 })
    await shot('6-room-archived')
    await page.getByRole('button', { name: 'Khôi phục' }).first().click()
    await dialog().getByRole('button', { name: 'Khôi phục' }).last().click()
    await expect(page.getByRole('button', { name: 'Ngừng dùng' }).first()).toBeVisible({ timeout: 15_000 })
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
