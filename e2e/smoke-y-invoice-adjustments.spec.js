import { expect, test } from '@playwright/test'

// Sửa sai sau khi chốt trên UI thật: bỏ nợ, đảo phiếu thu, hủy phiếu. GHI dữ liệu — chỉ chạy trên DB seed dùng một lần.
// Phiếu cần xử lý được chọn qua API (chỉ đọc) rồi thao tác bằng giao diện. Chạy SAU smoke-billing-write (cần có phiếu đã thu).
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-y-invoice-adjustments.spec.js   (API :5213 vừa seed + UI :5173)
const API = process.env.E2E_API_URL ?? 'http://localhost:5213/api/v1'
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.use({ actionTimeout: 15_000 })
test.setTimeout(150_000)

async function go(page, path) {
  await page.evaluate((to) => {
    history.pushState({}, '', to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

test('bỏ nợ, đảo phiếu thu, hủy phiếu', async ({ page, request }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
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
      await page.screenshot({ path: `test-results/adj-fail-${name.replace(/\W+/g, '_').slice(0, 30)}.png`, fullPage: true }).catch(() => {})
      await page.keyboard.press('Escape').catch(() => {})
    }
  }
  const dialog = () => page.locator('dialog[open]')

  const token = (await (await request.post(`${API}/auth/login`, { data: { username: OWNER.phone, password: OWNER.password } })).json()).accessToken
  const list = async (query) => (await (await request.get(`${API}/invoices?pageSize=100&status=Finalized&${query}`, { headers: { Authorization: `Bearer ${token}` } })).json()).items
  const regular = (items) => items.filter((i) => i.type === 'Regular')
  const owing = regular(await list('unpaidOnly=true')).find((i) => i.outstanding > 0 && i.paidAmount > 0) ?? regular(await list('unpaidOnly=true')).find((i) => i.outstanding > 0)
  const paidCandidates = regular(await list('')).filter((i) => i.paidAmount > 0 && i.outstanding === 0 && i.id !== owing?.id)
  const paid = paidCandidates[0]
  const unpaidCandidates = regular(await list('unpaidOnly=true')).filter((i) => i.paidAmount === 0 && i.id !== owing?.id)
  const unpaid = unpaidCandidates[0]
  expect(owing, 'seed không có phiếu đã chốt còn nợ').toBeTruthy()
  expect(paid, 'không có phiếu đã thu đủ (chạy smoke-billing-write trước)').toBeTruthy()
  expect(unpaid, 'không có phiếu đã chốt chưa thu đồng nào').toBeTruthy()

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  await run(`Bỏ nợ ${owing.invoiceNo}`, async () => {
    await go(page, `/invoices/${owing.id}`)
    await page.getByRole('button', { name: 'Bỏ nợ', exact: true }).click()
    await expect(dialog()).toBeVisible()
    await dialog().getByLabel('Lý do bỏ nợ').fill('Người thuê khó khăn, chủ trọ đồng ý bỏ (test UAT)')
    await page.screenshot({ path: 'test-results/adj-writeoff-dialog.png' })
    await dialog().getByRole('button', { name: 'Bỏ nợ', exact: true }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    expect(await page.locator('main').innerText()).toMatch(/Đã bỏ nợ|bỏ nợ/i)
  })

  // Phiếu đã thu có thể bị chặn đảo hợp lệ (vd. đã hoàn trả trên phiếu sau): hộp thoại phải GIẢI THÍCH rồi thử phiếu khác cho tới khi đảo được.
  await run('Đảo một phiếu thu', async () => {
    let reversed = null
    const blocked = []
    for (const candidate of paidCandidates.slice(0, 8)) {
      await go(page, `/invoices/${candidate.id}`)
      await page.getByRole('button', { name: 'Đảo', exact: true }).first().click()
      await expect(dialog()).toBeVisible()
      await dialog().getByRole('textbox').first().fill('Ghi nhầm số tiền (test UAT)')
      await dialog().getByRole('button', { name: 'Đảo phiếu thu' }).click()
      await page.waitForTimeout(1500)
      if ((await dialog().count()) === 0) {
        reversed = candidate
        break
      }
      blocked.push(`${candidate.invoiceNo}: ${(await dialog().innerText()).replace(/\s+/g, ' ').slice(0, 160)}`)
      await page.keyboard.press('Escape')
    }
    expect(reversed, `không phiếu nào đảo được: ${blocked.join(' || ')}`).toBeTruthy()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/adj-reversed.png', fullPage: true })
    // Sau khi đảo, phiếu phải quay lại còn nợ → có nút "Đã thu".
    await expect(page.getByRole('button', { name: 'Đã thu' }).first()).toBeVisible({ timeout: 10_000 })
  })

  // Chỉ hủy được phiếu MỚI NHẤT của hợp đồng: phiếu bị chặn hợp lệ thì hộp thoại phải giải thích, rồi thử phiếu khác.
  await run('Hủy một phiếu chưa thu', async () => {
    const blocked = []
    let done = false
    for (const candidate of unpaidCandidates.slice(0, 10)) {
      await go(page, `/invoices/${candidate.id}`)
      await page.getByRole('button', { name: 'Hủy phiếu' }).first().click()
      await expect(dialog()).toBeVisible()
      await dialog().getByRole('textbox').first().fill('Lập nhầm kỳ (test UAT)')
      const confirm = dialog().getByRole('button', { name: 'Hủy phiếu' })
      if (await confirm.isDisabled()) {
        blocked.push(`${candidate.invoiceNo}: nút khóa — ${(await dialog().innerText()).replace(/\s+/g, ' ').slice(0, 140)}`)
        await page.keyboard.press('Escape')
        continue
      }
      await confirm.click()
      await page.waitForTimeout(1500)
      if ((await dialog().count()) === 0) {
        done = true
        break
      }
      blocked.push(`${candidate.invoiceNo}: ${(await dialog().innerText()).replace(/\s+/g, ' ').slice(0, 140)}`)
      await page.keyboard.press('Escape')
    }
    expect(done, `không phiếu nào hủy được: ${blocked.join(' || ')}`).toBe(true)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/adj-voided.png', fullPage: true })
    expect(await page.locator('main').innerText()).toMatch(/Đã hủy/)
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
