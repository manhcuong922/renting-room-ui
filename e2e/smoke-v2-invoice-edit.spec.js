import { expect, test } from '@playwright/test'

// Phiếu nháp & thu tiền, các nhánh còn lại: thêm / sửa / xóa dòng, Tính lại, thêm phụ thu cho nhiều phòng + Chốt đã chọn,
// Thanh toán + bỏ phần còn lại, Sửa số đã thu, hóa đơn chờ hoàn tiền (Đã hoàn tiền → Bỏ xác nhận hoàn).
// GHI dữ liệu — chỉ chạy trên DB seed dùng một lần. Phiếu được chọn qua API (chỉ đọc) rồi thao tác bằng giao diện.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-v2-invoice-edit.spec.js   (API :5213 vừa seed + UI :5173)
const API = process.env.E2E_API_URL ?? 'http://localhost:5213/api/v1'
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

test('phiếu nháp, thu tiền và hoàn tiền: các nhánh còn lại', async ({ page, request }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (400|401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/inv2-${name}.png`, fullPage: true })
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
  // Mở phiếu rồi chờ đúng phiếu đó hiện ra: WebKit (dev) còn giữ trang phiếu trước một lúc sau khi đổi URL ⇒ bấm nhầm nút của phiếu cũ.
  const openInvoice = async (inv) => {
    await go(page, `/invoices/${inv.id}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(inv.invoiceNo ?? `phòng ${inv.roomCode}`, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')
  }
  const unique = Date.now().toString().slice(-6)
  const rowOf = (text, button) =>
    page.locator('tr:visible, li:visible, article:visible').filter({ hasText: text }).filter({ has: page.getByRole('button', { name: button }) }).last()

  const token = (await (await request.post(`${API}/auth/login`, { data: { username: OWNER.phone, password: OWNER.password } })).json()).accessToken
  const list = async (query) => (await (await request.get(`${API}/invoices?pageSize=100&${query}`, { headers: { Authorization: `Bearer ${token}` } })).json()).items
  const drafts = (await list('status=Draft')).filter((i) => i.type === 'Regular')
  const finalized = (await list('status=Finalized')).filter((i) => i.type === 'Regular')
  const draft = drafts[0]
  const owing = finalized.find((i) => i.outstanding > 100000 && i.paidAmount === 0) ?? finalized.find((i) => i.outstanding > 100000)
  const paid = finalized.find((i) => i.paidAmount > 100000 && i.id !== owing?.id)
  const refundPending = (await list('')).find((i) => i.paymentStatus === 'RefundPending')
  expect(draft, 'seed không có phiếu nháp').toBeTruthy()
  expect(owing, 'seed không có phiếu đã chốt còn nợ').toBeTruthy()
  expect(paid, 'seed không có phiếu đã thu').toBeTruthy()
  expect(refundPending, 'seed không có hóa đơn chờ hoàn tiền').toBeTruthy()

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  // ------------------------------------------------------------- Dòng trên phiếu nháp
  await run('Phiếu nháp: thêm dòng phụ thu', async () => {
    await openInvoice(draft)
    const before = await main().innerText()
    await page.getByRole('button', { name: 'Thêm dòng' }).click()
    await expect(dialog().getByText('Thêm dòng vào phiếu').first()).toBeVisible()
    await dialog().getByLabel('Nội dung').fill(`Phụ thu kiểm thử ${unique}`)
    await dialog().getByLabel(/Số tiền|Thành tiền/).first().fill('50000')
    await dialog().getByLabel('Lý do').fill('Kiểm thử UAT')
    await shot('1-add-line')
    await dialog().getByRole('button', { name: 'Thêm', exact: true }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(`Phụ thu kiểm thử ${unique}`, { timeout: 10_000 })
    expect(await main().innerText()).not.toEqual(before)
  })

  await run('Phiếu nháp: sửa → xóa dòng', async () => {
    await rowOf(`Phụ thu kiểm thử ${unique}`, /Sửa dòng/).getByRole('button', { name: /Sửa dòng/ }).click()
    await expect(dialog().getByText(/Sửa dòng/).first()).toBeVisible()
    await dialog().getByLabel('Thành tiền').fill('70000')
    await dialog().getByLabel(/Lý do|Ghi chú/).first().fill('Sửa số tiền (test UAT)')
    await dialog().locator('button[type="submit"]').click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText('70.000', { timeout: 10_000 })
    await rowOf(`Phụ thu kiểm thử ${unique}`, /Xóa dòng/).getByRole('button', { name: /Xóa dòng/ }).click()
    await expect(dialog()).toBeVisible()
    await dialog().getByRole('button', { name: /Xóa/ }).last().click()
    await expect(main()).not.toContainText(`Phụ thu kiểm thử ${unique}`, { timeout: 10_000 })
  })

  await run('Phiếu nháp: Tính lại', async () => {
    await page.getByRole('button', { name: 'Tính lại', exact: true }).first().click()
    await expect(dialog().getByText('Tính lại phiếu nháp?').first()).toBeVisible()
    await dialog().getByRole('button', { name: 'Tính lại', exact: true }).last().click()
    await expect(page.getByText(/Đã tính lại/).first()).toBeVisible({ timeout: 15_000 })
  })

  // ------------------------------------------------------------- Nhiều phiếu cùng lúc
  await run('Danh sách: thêm phụ thu cho nhiều phòng → Chốt đã chọn', async () => {
    await go(page, '/invoices')
    await page.getByRole('tab', { name: 'Nháp' }).click().catch(() => {})
    await page.waitForLoadState('networkidle')
    const boxes = page.locator('tbody input[type="checkbox"]:visible')
    expect(await boxes.count(), 'không có ô chọn phiếu nháp').toBeGreaterThan(1)
    await boxes.nth(0).check()
    await boxes.nth(1).check()
    await page.getByRole('button', { name: 'Thêm phụ thu / giảm trừ' }).click()
    await expect(dialog().getByText('Thêm phụ thu / giảm trừ cho nhiều phòng').first()).toBeVisible()
    await dialog().getByLabel('Nội dung').fill(`Thu chung kiểm thử ${unique}`)
    await dialog().getByLabel(/Số tiền/).first().fill('20000')
    await dialog().getByLabel('Lý do').fill('Kiểm thử UAT')
    await shot('2-bulk-line')
    await dialog().getByRole('button', { name: 'Thêm cho các phòng' }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    // Thêm phụ thu xong thì bỏ chọn; chọn lại đúng phiếu nháp chốt được (bỏ phiếu còn nhãn "Cần tính lại").
    const finalizable = page.locator('tbody tr:visible').filter({ hasText: 'Nháp' }).filter({ hasNotText: 'Cần tính lại' }).locator('input[type="checkbox"]')
    await finalizable.first().check()
    await page.getByRole('button', { name: 'Chốt đã chọn' }).click()
    await expect(dialog()).toBeVisible()
    await shot('3-bulk-finalize-dialog')
    await dialog().getByRole('button', { name: /Chốt/ }).last().click()
    await expect(page.getByText(/Đã chốt|chốt/i).first()).toBeVisible({ timeout: 20_000 })
  })

  // ------------------------------------------------------------- Thu tiền
  await run('Thanh toán + bỏ phần còn lại', async () => {
    await openInvoice(owing)
    await page.getByRole('button', { name: 'Thanh toán + bỏ phần còn lại' }).click()
    await expect(dialog().getByText(/Thanh toán \+ bỏ phần còn lại/).first()).toBeVisible()
    await dialog().getByLabel('Số tiền thực thu').fill(String(Math.max(0, owing.outstanding - 50000)))
    await dialog().getByLabel('Lý do bỏ phần còn lại').fill('Chủ trọ cho bớt (test UAT)')
    await shot('4-pay-and-writeoff')
    await dialog().getByRole('button', { name: 'Ghi thu và bỏ phần còn lại' }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(/Đã thu đủ|Đã bỏ nợ|bỏ nợ/i, { timeout: 10_000 })
  })

  await run('Sửa số đã thu', async () => {
    await openInvoice(paid)
    await page.getByRole('button', { name: /^Sửa/ }).first().click()
    await expect(dialog().getByText(/Sửa số đã thu/).first()).toBeVisible()
    await dialog().getByLabel('Số đã thu').fill(String(paid.paidAmount - 10000))
    const reason = dialog().getByRole('textbox').last()
    if (await reason.count()) await reason.fill('Đếm lại tiền mặt thiếu (test UAT)').catch(() => {})
    await shot('5-edit-paid')
    await dialog().locator('button[type="submit"]').click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(/Còn nợ|10\.000/, { timeout: 10_000 })
  })

  // ------------------------------------------------------------- Chờ hoàn tiền
  await run('Hóa đơn chờ hoàn tiền: Đã hoàn tiền → Bỏ xác nhận hoàn', async () => {
    await openInvoice(refundPending)
    await page.getByRole('button', { name: 'Đã hoàn tiền', exact: true }).click()
    await expect(dialog().getByText('Xác nhận đã hoàn tiền').first()).toBeVisible()
    await shot('6-refund-dialog')
    await dialog().getByRole('button', { name: 'Đã hoàn tiền', exact: true }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Bỏ xác nhận hoàn' })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Bỏ xác nhận hoàn' }).click()
    await dialog().getByRole('button', { name: 'Bỏ xác nhận' }).last().click()
    await expect(page.getByRole('button', { name: 'Đã hoàn tiền', exact: true })).toBeVisible({ timeout: 10_000 })
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
