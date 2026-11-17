import { expect, test } from '@playwright/test'

// Hoàn tất thanh lý trên UI thật, bắt đầu từ HĐ đang thanh lý sẵn của dữ liệu demo (A·105, HD2026-0017):
// lập hóa đơn trả phòng → chốt → thu → xử lý cọc → hoàn tất. GHI dữ liệu — chỉ chạy trên DB seed dùng một lần.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-liquidation-complete.spec.js   (API :5213 vừa seed + UI :5173)
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])
const CONTRACT_NO = 'HD2026-0017'

test.use({ actionTimeout: 15_000 })
test.setTimeout(180_000)

async function go(page, path) {
  await page.evaluate((to) => {
    history.pushState({}, '', to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
}

/** Điền mọi ô số còn trống trong hộp thoại bằng số "Mới nhất" đang hiện cạnh ô. */
async function fillLatestReadings(dialog) {
  const inputs = dialog.locator('input[inputmode="decimal"], input[type="text"]:not([maxlength])')
  for (let i = 0; i < (await inputs.count()); i++) {
    const input = inputs.nth(i)
    if ((await input.inputValue()) !== '') continue
    const text = await input.locator('xpath=ancestor::*[contains(., "Mới nhất")][1]').innerText().catch(() => '')
    const m = text.match(/Mới nhất:\s*([\d.]+(?:,\d+)?)/)
    if (m) await input.fill(m[1].replace(/\./g, ''))
  }
}

test('hoàn tất thanh lý: hóa đơn trả phòng → chốt → thu → cọc → hoàn tất', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/lc-${name}.png`, fullPage: true })
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
  const toast = (re) => expect(page.getByText(re).first()).toBeVisible({ timeout: 15_000 })

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  const openContract = async () => {
    await go(page, '/contracts')
    await page.getByLabel('Tìm số hợp đồng').fill(CONTRACT_NO)
    await page.waitForTimeout(900)
    await page.locator(`a[href^="/contracts/"]:has-text("${CONTRACT_NO}"):visible`).first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Đang thanh lý').first()).toBeVisible()
  }

  await run('Lập hóa đơn trả phòng', async () => {
    await openContract()
    await shot('0-before')
    // Chờ nút vẽ xong rồi mới kết luận "đã lập ở lần chạy trước" (kiểm ngay thì dữ liệu hợp đồng chưa về → nhầm là đã lập).
    await page.getByRole('button', { name: 'Lập hóa đơn trả phòng' }).first().waitFor({ timeout: 6_000 }).catch(() => {})
    if (!(await page.getByRole('button', { name: 'Lập hóa đơn trả phòng' }).count())) return
    await page.getByRole('button', { name: 'Lập hóa đơn trả phòng' }).first().click()
    await expect(dialog().getByText('Lập hóa đơn trả phòng').first()).toBeVisible()
    await fillLatestReadings(dialog())
    await dialog().getByRole('button', { name: 'Lập hóa đơn' }).click()
    await toast(/Đã lập hóa đơn trả phòng/)
  })

  await run('Chốt hóa đơn trả phòng', async () => {
    await openContract()
    await page.getByText('Mở hóa đơn trả phòng').first().waitFor({ timeout: 6_000 }).catch(() => {})
    if ((await page.getByText('Mở hóa đơn trả phòng').count()) === 0) return
    await page.getByRole('link', { name: /PB|Mở hóa đơn trả phòng|Xem hóa đơn/i }).first().click()
    await page.waitForLoadState('networkidle')
    const finalize = page.getByRole('button', { name: 'Chốt phiếu' }).first()
    await finalize.waitFor({ timeout: 6_000 }).catch(() => {}) // chờ nút vẽ xong rồi mới kết luận "đã chốt ở lần chạy trước"
    if (!(await finalize.count())) return
    await expect(finalize).toBeVisible()
    if (await finalize.isDisabled()) throw new Error('hóa đơn trả phòng chưa chốt được (nút Chốt phiếu bị khóa)')
    await finalize.click()
    await dialog().getByRole('button', { name: 'Chốt phiếu' }).click()
    await toast(/Đã chốt phiếu/)
    await shot('1-finalized')
  })

  await run('Thu tiền hóa đơn trả phòng (nếu còn nợ)', async () => {
    const pay = page.getByRole('button', { name: 'Đã thu' }).first()
    await pay.waitFor({ timeout: 6_000 }).catch(() => {})
    if (await pay.count()) {
      await pay.click()
      await dialog().getByRole('button', { name: 'Ghi thu' }).click()
      await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    }
    await shot('2-paid')
  })

  await run('Xử lý cọc rồi hoàn tất thanh lý', async () => {
    await openContract()
    const refund = page.getByRole('button', { name: 'Đã hoàn trả cọc' }).first()
    if (await refund.count()) {
      await refund.click()
      await shot('3-deposit-dialog')
      await dialog().getByRole('button', { name: /Ghi|Xác nhận|Lưu|Hoàn/ }).last().click()
      await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    }
    const finish = page.getByRole('button', { name: 'Hoàn tất thanh lý' }).first()
    await expect(finish).toBeVisible()
    // Dữ liệu hợp đồng được tải lại ngay khi vào trang; chờ nút mở khóa thay vì đọc ngay lúc còn dữ liệu cũ.
    await expect(finish).toBeEnabled({ timeout: 8_000 }).catch(() => {})
    if (await finish.isDisabled()) {
      const todo = await page.getByText(/Còn phải làm trước khi hoàn tất/).locator('xpath=..').innerText().catch(() => '(không thấy danh sách việc còn lại)')
      throw new Error(`nút Hoàn tất thanh lý bị khóa — ${todo.replace(/\s+/g, ' ').slice(0, 300)}`)
    }
    await finish.click()
    await shot('4-complete-dialog')
    await dialog().getByRole('button', { name: /Hoàn tất/ }).last().click()
    await toast(/thanh lý|kết thúc|Đã hoàn tất/i)
    await shot('5-done')
    expect(await page.locator('main').innerText()).toMatch(/Đã kết thúc/)
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
