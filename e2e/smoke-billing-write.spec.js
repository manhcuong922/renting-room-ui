import { expect, test } from '@playwright/test'

// Luồng GHI dữ liệu cuối tháng trên UI thật: nhập chỉ số → tạo phiếu nháp → chốt → ghi thu. Chỉ chạy trên DB seed dùng một lần.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-billing-write.spec.js   (API :5213 vừa seed + UI :5173)
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])
const MONTH = new Date().toISOString().slice(0, 7)

async function go(page, path) {
  await page.evaluate((to) => {
    history.pushState({}, '', to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
}

/** Chọn khu theo mã (vd. "A") thay vì thứ tự — thứ tự danh sách khu không cố định. */
async function pickProperty(select, code) {
  // Danh sách khu nạp sau khi trang mở (chậm hơn ở WebKit): chờ tới 10 giây cho khu cần chọn xuất hiện.
  let label
  for (let attempt = 0; attempt < 20 && !label; attempt++) {
    label = (await select.locator('option').allTextContents()).find((t) => t.trim().startsWith(`${code} —`))
    if (!label) await select.page().waitForTimeout(500)
  }
  if (!label) throw new Error(`không có khu ${code} trong danh sách`)
  await select.selectOption({ label })
}

/** "1.100,5 kWh" / "1.100\n01/10/2026" → 1100.5 (định dạng vi-VN). */
const parseReading = (text) => {
  const m = (text || '').match(/\d[\d.]*(?:,\d+)?/)
  return m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : null
}

const dialogProblems = (page) =>
  page.evaluate(() => {
    const dlg = document.querySelector('dialog[open]')
    if (!dlg) return []
    const d = dlg.getBoundingClientRect()
    return d.right > innerWidth + 1 || d.left < -1 ? [`hộp thoại tràn khỏi màn hình (${Math.round(d.left)}→${Math.round(d.right)} / ${innerWidth})`] : []
  })

test.use({ actionTimeout: 15_000 })
test.setTimeout(150_000)

test('cuối tháng: nhập chỉ số → tạo phiếu → chốt → thu tiền', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const run = async (name, fn) => {
    step = name
    try {
      await fn()
    } catch (e) {
      issues.push(`[${name}] ${String(e.message).split('\n').slice(0, 5).join(' | ').slice(0, 500)}`)
      await page.screenshot({ path: `test-results/write-fail-${name.replace(/\W+/g, '_').slice(0, 40)}.png` }).catch(() => {})
      await page.keyboard.press('Escape').catch(() => {})
    }
    for (const p of await dialogProblems(page)) issues.push(`[${name}] ${p}`)
  }

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  await run('Ghi chỉ số khu A tháng này', async () => {
    await go(page, '/meter-readings')
    const property = page.getByLabel('Khu trọ')
    await pickProperty(property, 'A') // khu thu sau
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Tháng thu').fill(MONTH)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'test-results/write-meter-sheet-before.png', fullPage: true })

    const rows = page.locator('table tbody tr')
    const n = await rows.count()
    let filled = 0
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i)
      const input = row.locator('input[aria-label^="Chỉ số mới"]')
      if (!(await input.count()) || (await input.isDisabled()) || (await input.inputValue())) continue
      const previous = parseReading(await row.locator('td').nth(2).innerText())
      if (previous === null) continue
      await input.fill(String(previous + 40).replace('.', ','))
      filled++
    }
    expect(filled, 'không có dòng nào để nhập chỉ số').toBeGreaterThan(0)
    await page.getByRole('button', { name: /^Lưu \d+ chỉ số$/ }).click()
    await expect(page.getByText(/Đã lưu|đã ghi|Đã ghi/i).first()).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: 'test-results/write-meter-sheet-after.png', fullPage: true })
  })

  await run('Tạo phiếu khu A', async () => {
    await go(page, '/invoices')
    await page.getByRole('button', { name: 'Tạo phiếu' }).first().click()
    const dialog = page.locator('dialog[open]')
    await pickProperty(dialog.getByLabel('Khu trọ'), 'A')
    await dialog.getByRole('button', { name: 'Tạo phiếu nháp' }).click()
    await expect(page.getByText(/Đã tạo [1-9]\d* phiếu nháp/)).toBeVisible({ timeout: 20_000 })
    await page.screenshot({ path: 'test-results/write-generated.png' })
    await page.keyboard.press('Escape')
  })

  await run('Chốt một phiếu nháp rồi ghi thu', async () => {
    await go(page, '/invoices')
    await page.getByRole('tab', { name: 'Nháp' }).click().catch(() => {})
    await page.waitForLoadState('networkidle')
    const link = page.locator('a[href^="/invoices/"]').first()
    await link.click()
    await page.waitForLoadState('networkidle')
    const finalize = page.getByRole('button', { name: 'Chốt phiếu' }).first()
    await expect(finalize).toBeVisible()
    if (await finalize.isDisabled()) throw new Error('phiếu nháp đầu tiên chưa chốt được (nút Chốt phiếu bị khóa)')
    await finalize.click()
    await page.locator('dialog[open]').getByRole('button', { name: 'Chốt phiếu' }).click()
    await expect(page.getByRole('button', { name: 'Đã thu' }).first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Đã thu' }).first().click()
    await page.screenshot({ path: 'test-results/write-pay-dialog.png' })
    await page.locator('dialog[open]').getByRole('button', { name: 'Ghi thu' }).click()
    await expect(page.locator('dialog[open]')).toHaveCount(0, { timeout: 15_000 })
    await page.screenshot({ path: 'test-results/write-paid.png', fullPage: true })
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
