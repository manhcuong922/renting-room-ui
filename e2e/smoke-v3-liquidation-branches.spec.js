import { expect, test } from '@playwright/test'

// Các nhánh phụ của thanh lý trên UI thật, dùng HĐ đang thanh lý sẵn trong dữ liệu demo:
//  · A·105 (HD2026-0005, ngày trả phòng tương lai): đổi cách thu kỳ cuối, Không trả cọc → Bỏ đánh dấu, Hủy thanh lý
//  · A·101 (HD2026-0001, đang ở): hộp thoại bắt đầu thanh lý, kỳ chưa lập → "Coi như trả phòng từ…"
//  · B·B10 (HD2026-0042, trả phòng 14/11): hộp thoại "Đã xử lý ngoài hệ thống"
//  · B·B01 (HD2026-0040, hóa đơn trả phòng ÂM): hoàn tất kèm xác nhận đã trả lại tiền ngay trong hộp thoại hoàn tất
// GHI dữ liệu — chỉ chạy trên DB seed dùng một lần. Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-v3-liquidation-branches.spec.js
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

test('thanh lý: các nhánh phụ', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (400|401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/liq3-${name}.png`, fullPage: true })
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
    await page.waitForTimeout(800) // chờ dữ liệu hợp đồng tải lại xong (trang thoáng hiện dữ liệu cũ)
  }

  // ------------------------------------------------------------- Kỳ cuối
  await run('Kỳ cuối: đổi "Không thu" → "Tính theo ngày ở" (lưu lại sau khi tải lại)', async () => {
    await openContract('HD2026-0005')
    await page.locator('label', { hasText: /Không thu/ }).click()
    await page.waitForLoadState('networkidle')
    await shot('1-final-period-none')
    await expect(page.getByRole('radio', { name: /Không thu/ })).toBeChecked()
    await page.locator('label', { hasText: /Tính theo ngày ở/ }).click()
    await page.waitForLoadState('networkidle')
    await openContract('HD2026-0005')
    await expect(page.getByRole('radio', { name: /Tính theo ngày ở/ }), 'lựa chọn kỳ cuối không được lưu').toBeChecked()
  })

  // ------------------------------------------------------------- Cọc
  await run('Cọc: Không trả cọc → Bỏ đánh dấu', async () => {
    await page.getByRole('button', { name: 'Không trả cọc' }).first().click()
    await expect(dialog()).toBeVisible()
    await dialog().getByLabel('Ngày quyết định').fill(new Date().toISOString().slice(0, 10)) // không điền sẵn như hộp thoại hoàn cọc
    await dialog().getByLabel('Lý do').fill('Người thuê vi phạm điều khoản (test UAT)')
    await shot('2-forfeit-dialog')
    await dialog().locator('button[type="submit"]').click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText('Không trả cọc', { timeout: 10_000 })
    await page.getByRole('button', { name: 'Bỏ đánh dấu' }).first().click()
    await dialog().getByRole('button', { name: /Bỏ đánh dấu|Xác nhận/ }).last().click()
    await expect(page.getByRole('button', { name: 'Không trả cọc' }).first()).toBeVisible({ timeout: 10_000 })
  })

  await run('Hủy thanh lý → hợp đồng về Đang hiệu lực', async () => {
    await page.getByRole('button', { name: 'Hủy thanh lý' }).first().click()
    await expect(dialog()).toBeVisible()
    const box = dialog().getByRole('textbox').first()
    if (await box.count()) await box.fill('Người thuê ở lại (test UAT)')
    await dialog().getByRole('button', { name: /Hủy thanh lý|Xác nhận/ }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(/Đang hiệu lực/, { timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Thanh lý' }).first()).toBeVisible()
    await shot('4-liquidation-cancelled')
  })

  // ------------------------------------------------------------- Coi như trả phòng từ
  await run('Bắt đầu thanh lý HĐ đang ở: ngày trả xa → "Coi như trả phòng từ…" đổi ngày', async () => {
    await openContract('HD2026-0001')
    await page.getByRole('button', { name: 'Thanh lý' }).first().click()
    await expect(dialog().getByText('Thanh lý — trả phòng').first()).toBeVisible()
    const dateField = dialog().getByLabel('Ở đến hết ngày')
    // Trả phòng cuối tháng sau ⇒ kỳ tháng này chưa lập hóa đơn ⇒ gợi ý coi như đã trả phòng từ cuối kỳ đã lập.
    await dateField.fill(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10))
    const before = await dateField.inputValue()
    const treat = dialog().getByRole('button', { name: /Coi như trả phòng từ/ })
    await expect(treat, 'kỳ đã qua chưa lập hóa đơn nhưng không có gợi ý "Coi như trả phòng từ"').toBeVisible({ timeout: 10_000 })
    await shot('5-treat-as-ended')
    await treat.click()
    expect(await dateField.inputValue(), 'ngày trả phòng không đổi sau khi bấm "Coi như trả phòng từ"').not.toEqual(before)
    await page.keyboard.press('Escape')
  })

  // ------------------------------------------------------------- Đã xử lý ngoài hệ thống
  // Nút chỉ hiện khi HĐ đã tới ngày trả phòng và CHƯA có hóa đơn trả phòng ⇒ bắt đầu thanh lý A·207 (HD2026-0012, chưa có phiếu nào nên không bị phiếu nháp chặn) hôm nay trước.
  await run('Hộp thoại "Đã xử lý ngoài hệ thống" mở được và hủy được', async () => {
    await openContract('HD2026-0012')
    const startLiquidation = async () => {
      await page.getByRole('button', { name: 'Thanh lý' }).first().click()
      await expect(dialog().getByText('Thanh lý — trả phòng').first()).toBeVisible()
      await page.waitForTimeout(800)
      // Chỉ số cuối (nếu bắt buộc): điền số "Mới nhất" cạnh từng ô còn trống.
      const inputs = dialog().locator('input[inputmode="decimal"], input[type="text"]:not([maxlength])')
      for (let i = 0; i < (await inputs.count()); i++) {
        const input = inputs.nth(i)
        if ((await input.inputValue()) !== '') continue
        const text = await input.locator('xpath=ancestor::*[contains(., "Mới nhất")][1]').innerText().catch(() => '')
        const m = text.match(/Mới nhất:\s*([\d.]+(?:,\d+)?)/)
        if (m) await input.fill(m[1].replace(/\./g, ''))
      }
    }
    await startLiquidation()
    // Phiếu nháp của kỳ có ngày trả phòng khóa nút bắt đầu (spec khác có thể đã lập): mở phiếu theo liên kết trong hộp thoại, xóa nháp, thanh lý lại.
    if (await dialog().getByRole('button', { name: 'Bắt đầu thanh lý' }).isDisabled()) {
      await dialog().locator('a[href^="/invoices/"]').first().click()
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Xóa nháp' }).first().click()
      await dialog().getByRole('button', { name: /Xóa/ }).last().click()
      await page.waitForURL(/\/invoices$/, { timeout: 15_000 }) // xóa xong app tự về danh sách phiếu; chờ xong rồi mới điều hướng tiếp
      await openContract('HD2026-0012')
      await startLiquidation()
    }
    await dialog().getByRole('button', { name: 'Bắt đầu thanh lý' }).click()
    await expect(page.getByText('Đã chuyển sang thanh lý.').first()).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /Đã xử lý ngoài hệ thống/ }).first().click()
    await expect(dialog()).toBeVisible()
    await shot('3-outside-system-dialog')
    await dialog().getByRole('button', { name: /^Hủy$|Đóng/ }).first().click()
    await expect(dialog()).toHaveCount(0)
  })

  // ------------------------------------------------------------- Hóa đơn trả phòng âm
  await run('Hóa đơn trả phòng âm: hoàn tất kèm xác nhận đã trả lại tiền', async () => {
    await openContract('HD2026-0040')
    await expect(main()).toContainText(/Cần trả lại người thuê/)
    await shot('6-negative-before')
    await page.getByRole('button', { name: 'Hoàn tất thanh lý' }).first().click()
    await expect(dialog()).toBeVisible()
    await page.waitForTimeout(800)
    await shot('7-complete-dialog')
    // Tiền cần trả lại phải được xử lý ngay trong hộp thoại hoàn tất (xác nhận đã trả, hoặc "Không hoàn" kèm lý do).
    await expect(dialog()).toContainText(/trả lại|hoàn/i)
    const paid = dialog().getByRole('checkbox', { name: /Đã trả|Đã hoàn/ })
    if (await paid.count()) await paid.first().check()
    else await dialog().locator('label', { hasText: /Đã trả|Đã hoàn/ }).first().click()
    await dialog().getByRole('button', { name: /Hoàn tất/ }).last().click()
    await expect(main()).toContainText(/Đã kết thúc/, { timeout: 20_000 })
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
