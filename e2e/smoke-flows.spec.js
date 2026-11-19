import { expect, test } from '@playwright/test'

// Luồng tương tác thật trên dữ liệu demo (khác smoke-all-pages: ở đây bấm, lọc, mở hộp thoại, tạo phiếu hàng loạt).
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-flows.spec.js   (cần API :5213 vừa seed + UI :5173)
// Lưu ý: bước tạo phiếu GHI vào DB — chỉ chạy trên DB seed dùng một lần.
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

async function go(page, path) {
  await page.evaluate((to) => {
    history.pushState({}, '', to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
}

/** Hộp thoại đang mở có vỡ không: tràn ngang, nội dung ra ngoài khung, nút bị che. */
const dialogProblems = (page) =>
  page.evaluate(() => {
    const out = []
    const dlg = document.querySelector('dialog[open]')
    if (!dlg) return out
    const d = dlg.getBoundingClientRect()
    if (d.right > innerWidth + 1 || d.left < -1) out.push(`hộp thoại tràn khỏi màn hình (${Math.round(d.left)}→${Math.round(d.right)} / ${innerWidth})`)
    for (const el of dlg.querySelectorAll('button, input, select, textarea, [role="radiogroup"]')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      if (r.right > d.right + 1 && !el.closest('table, [class*="scroll"], [class*="table"]'))
        out.push(`phần tử vượt khung hộp thoại: <${el.tagName.toLowerCase()}> "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}"`)
    }
    return out
  })

test('luồng tương tác chính', async ({ page }, testInfo) => {
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
      await page.keyboard.press('Escape').catch(() => {})
    }
    const dlg = await dialogProblems(page)
    for (const p of dlg) issues.push(`[${name}] ${p}`)
  }

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  await run('Hợp đồng: bộ lọc nhanh + tab + tìm kiếm', async () => {
    await go(page, '/contracts')
    const quick = page.getByLabel('Bộ lọc nhanh')
    await expect.poll(async () => await quick.locator('option').count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(6)
    const options = await quick.locator('option').allTextContents()
    for (const label of options) {
      await quick.selectOption({ label })
      await page.waitForLoadState('networkidle')
      await expect(page.locator('table, [class*="empty" i]').first()).toBeVisible()
    }
    await quick.selectOption({ index: 0 })
    for (const tab of ['Nháp', 'Đang hiệu lực', 'Đang thanh lý', 'Đã kết thúc', 'Đã hủy', 'Tất cả']) {
      await page.getByRole('tab', { name: tab }).click()
      await page.waitForLoadState('networkidle')
    }
    await page.getByLabel('Tìm số hợp đồng').fill('HD2026-0001')
    await page.waitForTimeout(800)
    await expect(page.getByText('HD2026-0001').first()).toBeVisible()
  })

  await run('Phòng: đổi chế độ xem + lọc', async () => {
    await go(page, '/rooms')
    const radios = page.getByRole('radiogroup').first().locator('label')
    const n = await radios.count()
    for (let i = 0; i < n; i++) {
      await radios.nth(i).click()
      await page.waitForLoadState('networkidle')
    }
    await page.getByLabel('Tầng').fill('2')
    await page.waitForTimeout(800)
  })

  await run('Phiếu: mở hộp thoại Tạo phiếu', async () => {
    await go(page, '/invoices')
    await page.getByRole('button', { name: 'Tạo phiếu' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.screenshot({ path: 'test-results/flow-generate-dialog.png' })
    const bad = await dialogProblems(page)
    for (const p of bad) issues.push(`[Tạo phiếu] ${p}`)
  })

  await run('Phiếu: tạo hàng loạt mọi khu → kết quả + bỏ qua kỳ chưa lập', async () => {
    await page.getByRole('button', { name: 'Tạo phiếu nháp' }).click()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: 'test-results/flow-after-generate.png' })
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/Kết quả tạo phiếu/).first()).toBeVisible({ timeout: 20_000 })
    await page.screenshot({ path: 'test-results/flow-generate-result.png' })
    const bad = await dialogProblems(page)
    for (const p of bad) issues.push(`[Kết quả tạo phiếu] ${p}`)
    const skip = dialog.getByRole('button', { name: /Bỏ qua các kỳ chưa lập/ })
    if (await skip.count()) {
      await skip.click()
      await expect(dialog.getByText(/chưa có phiếu các kỳ trước/).first()).toBeVisible()
      await page.screenshot({ path: 'test-results/flow-skip-dialog.png' })
      for (const p of await dialogProblems(page)) issues.push(`[Bỏ qua kỳ chưa lập] ${p}`)
      const confirm = dialog.getByRole('button', { name: /Bỏ qua \d+ kỳ và tạo phiếu/ })
      await expect(confirm).toBeDisabled()
      await dialog.getByLabel(/Tôi xác nhận/).check()
      await expect(confirm).toBeEnabled()
      await dialog.getByRole('button', { name: 'Quay lại' }).click()
    }
    await page.keyboard.press('Escape')
  })

  await run('Ghi chỉ số: mở trang + lọc', async () => {
    await go(page, '/meter-readings')
    await expect(page.locator('main')).toBeVisible()
    await page.screenshot({ path: 'test-results/flow-meter-readings.png', fullPage: true })
  })

  // Nút hành động chính của từng trang → hộp thoại mở được, không vỡ, đóng được bằng Esc.
  const PRIMARY = [
    ['/renters', /Thêm người thuê|Thêm/],
    ['/members', /Thêm|Mời|Tạo/],
  ]
  for (const [path, label] of PRIMARY) {
    await run(`Hộp thoại chính ${path}`, async () => {
      await go(page, path)
      const btn = page.getByRole('button', { name: label }).first()
      if (!(await btn.count())) return void issues.push(`[${path}] không thấy nút hành động chính`)
      await btn.click()
      await page.waitForTimeout(400)
      if (await page.getByRole('dialog').count()) {
        await page.screenshot({ path: `test-results/flow-dialog-${path.replace(/\W+/g, '_')}.png` })
        for (const p of await dialogProblems(page)) issues.push(`[${path}] ${p}`)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
    })
  }

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
