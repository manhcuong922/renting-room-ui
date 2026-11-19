import { expect, test } from '@playwright/test'

// Tổng quan & thao tác nhanh (UI thật): mỗi thẻ / dòng "Cần xử lý" dẫn tới đúng danh sách đã lọc (số trên thẻ = số dòng danh sách);
// lưới ghi chỉ số: Enter nhảy sang ô kế. Chỉ đọc (không lưu chỉ số). Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-v10-dashboard-ux.spec.js
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.use({ actionTimeout: 15_000 })
test.setTimeout(180_000)

async function go(page, to) {
  await page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, to)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

/** "1–8 / 8" ở chân danh sách → 8. */
async function listTotal(page) {
  const text = await page.getByText(/^\d+–\d+ \/ \d+$/).first().innerText({ timeout: 10_000 })
  return Number(text.split('/')[1].trim())
}

test('tổng quan: thẻ & việc cần xử lý dẫn đúng danh sách; ghi chỉ số: Enter sang ô kế', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (400|401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const run = async (name, fn) => {
    step = name
    try {
      await fn()
    } catch (e) {
      issues.push(`[${name}] ${String(e.message).split('\n').slice(0, 5).join(' | ').slice(0, 600)}`)
      await page.screenshot({ path: `test-results/dash10-fail-${name.replace(/\W+/g, '_').slice(0, 30)}.png`, fullPage: true }).catch(() => {})
    }
  }

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  // Mỗi dòng "Cần xử lý": bấm → danh sách có đúng số đó.
  for (const re of [/phiếu nháp chờ chốt/, /phiếu cần gửi lại/, /hợp đồng đang thanh lý/, /hợp đồng nháp chưa kích hoạt/]) {
    await run(`Cần xử lý: ${re.source}`, async () => {
      await go(page, '/')
      const link = page.getByRole('link', { name: re })
      await expect(link, 'seed phải có việc này').toBeVisible({ timeout: 10_000 })
      const count = Number((await link.innerText()).match(/\d+/)[0])
      await link.click()
      await page.waitForLoadState('networkidle')
      await expect.poll(() => listTotal(page), { timeout: 10_000, message: `bấm "${re.source}" (${count}) mà danh sách không khớp` }).toBe(count)
    })
  }

  for (const [label, re] of [
    ['HĐ quá hạn', /HĐ quá hạn/],
    ['HĐ hết hạn trong 30 ngày', /HĐ hết hạn trong 30 ngày/],
  ]) {
    await run(`Thẻ ${label} → danh sách đã lọc`, async () => {
      await go(page, '/')
      const card = page.getByRole('link', { name: re })
      await expect(card).toContainText(/\d/, { timeout: 10_000 })
      const count = Number((await card.innerText()).match(/(\d+)\s*$/)[1])
      await card.click()
      await page.waitForLoadState('networkidle')
      if (count === 0) await expect(page.locator('main')).toContainText(/Không có|Chưa có|không có/, { timeout: 10_000 })
      else await expect.poll(() => listTotal(page), { timeout: 10_000, message: `thẻ ${label} (${count}) dẫn tới danh sách không lọc` }).toBe(count)
    })
  }

  await run('Ghi chỉ số: Enter nhảy sang ô kế tiếp', async () => {
    await go(page, '/meter-readings')
    const inputs = page.locator('input[data-grid="readings"]:visible:not([disabled])')
    await expect.poll(() => inputs.count(), { timeout: 10_000 }).toBeGreaterThan(1)
    const first = inputs.nth(0)
    const secondLabel = await inputs.nth(1).getAttribute('aria-label')
    await first.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label')), { timeout: 3_000 }).toBe(secondLabel)
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
