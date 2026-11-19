import { expect, test } from '@playwright/test'

// Người ở & hợp đồng, các nhánh còn lại (UI thật): đổi vai trò đồng thuê, đổi người đứng tên, chuyển một người sang phòng khác,
// đánh dấu đã có bản ký, ký lại kèm chuyển cọc. GHI dữ liệu — chỉ chạy trên DB seed dùng một lần.
// Dùng B·B04 (HD2026-0044, 4 người ở) cho các bước người ở; B·B09 (HD2026-0048) cho ký lại; A·101 (HD2026-0001) cho bản ký.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-v6-contract-people.spec.js   (API :5213 vừa seed + UI :5173)
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

test('hợp đồng: đổi vai trò, đổi người đứng tên, chuyển người, bản ký, ký lại kèm cọc', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (400|401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/ppl-${name}.png`, fullPage: true })
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

  const openContract = async (no, tab) => {
    await go(page, '/contracts')
    await page.getByLabel('Tìm số hợp đồng').fill(no)
    await page.waitForTimeout(900)
    await page.locator(`a[href^="/contracts/"]:has-text("${no}"):visible`).first().click()
    await page.waitForLoadState('networkidle')
    await expect(main()).toContainText(no)
    await page.waitForTimeout(600)
    if (tab) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
      await page.waitForTimeout(400)
    }
  }

  // Tên các người ở của B04 (cột đầu bảng) để chọn người cho các bước sau.
  let names = []
  await run('B04: đọc danh sách người ở', async () => {
    await openContract('HD2026-0044', 'Người ở')
    names = (await page.locator('tbody tr:visible td:first-child').allInnerTexts()).map((t) => t.trim().split('\n')[0]).filter(Boolean)
    expect(names.length, 'B04 không có đủ người ở').toBeGreaterThanOrEqual(3)
    await shot('1-occupants')
  })

  await run('Đổi vai trò: đặt làm đồng thuê → bỏ đồng thuê', async () => {
    const roleButton = page.locator('tbody tr:visible').filter({ hasNotText: /Đứng tên/ }).getByRole('button', { name: /Đồng thuê|đồng thuê/ }).first()
    await roleButton.click()
    await expect(dialog()).toBeVisible()
    await dialog().getByRole('button', { name: /Đặt làm đồng thuê|Bỏ đồng thuê/ }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(/Đồng thuê/, { timeout: 10_000 })
    await shot('2-cotenant')
  })

  await run('Đổi người đứng tên sang một người đang ở', async () => {
    const newRep = names.find((n) => !/Lê Văn|Hồ Thị Hạnh/.test('') && n) // người đầu tiên khác người đứng tên (kiểm tra lại bằng hộp thoại)
    await page.getByRole('button', { name: /Đổi người đứng tên/ }).first().click()
    await expect(dialog().getByText('Đổi người đứng tên').first()).toBeVisible()
    const rep = dialog().getByPlaceholder('Tìm người thuê…')
    // Thử lần lượt từng người ở cho tới khi hộp thoại nhận (người đứng tên hiện tại bị loại khỏi danh sách tìm).
    let chosen = false
    for (const n of names) {
      await rep.fill(n.split(' ').slice(-2).join(' '))
      await page.waitForTimeout(700)
      // Chỉ lấy gợi ý của ô tìm (role=option do ứng dụng vẽ), không lấy <option> của ô chọn chủ hộ ở dưới.
      const option = dialog().locator('[role="option"]').first()
      await option.waitFor({ timeout: 3_000 }).catch(() => {})
      if (await option.count()) {
        await option.click()
        chosen = true
        break
      }
    }
    expect(chosen, `không chọn được người đứng tên mới trong ${names.join(', ')} (${newRep ?? ''})`).toBe(true)
    await dialog().getByLabel('Đứng tên từ ngày').fill(isoToday())
    await shot('3-rep-dialog')
    await dialog().getByRole('button', { name: 'Đổi người đứng tên' }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(/Lịch sử người đứng tên/, { timeout: 10_000 })
  })

  await run('Chuyển một người sang phòng khác', async () => {
    await page.locator('tbody tr:visible').getByRole('button', { name: 'Sang phòng khác' }).last().click()
    await expect(dialog().getByText(/sang phòng khác/).first()).toBeVisible()
    const target = dialog().getByLabel('Chuyển tới phòng (hợp đồng đang hiệu lực)')
    await expect.poll(async () => await target.locator('option:not([value=""])').count(), { timeout: 10_000, message: 'không có phòng đích' }).toBeGreaterThan(0)
    const relation = dialog().getByLabel('Quan hệ với chủ hộ ở hợp đồng mới')
    if (await relation.count()) await relation.selectOption({ index: 1 })
    await dialog().getByLabel('Ngày chuyển').fill(isoToday())
    await shot('4-move-dialog')
    // Hợp đồng đích có thể mới ký và bắt đầu từ ngày mai (B06) ⇒ "ngày chuyển hôm nay" ngoài thời gian hợp đồng; hộp thoại báo rõ,
    // thử lần lượt từng hợp đồng đích cho tới khi nhận.
    const values = await target.locator('option:not([value=""])').evaluateAll((os) => os.map((o) => o.value))
    let moved = false
    const rejected = []
    for (const value of values) {
      await target.selectOption(value)
      await dialog().getByRole('button', { name: 'Chuyển người' }).click()
      await page.waitForTimeout(1500)
      if ((await page.locator('dialog[open]').count()) === 0) {
        moved = true
        break
      }
      rejected.push((await dialog().locator('[class*="error" i], [role="alert"]').allInnerTexts()).join(' ').replace(/\s+/g, ' ').slice(0, 80))
    }
    expect(moved, `không hợp đồng đích nào nhận: ${rejected.join(' || ')}`).toBe(true)
  })

  await run('Đánh dấu đã có bản ký (A·101)', async () => {
    await openContract('HD2026-0001')
    await page.getByRole('button', { name: /Đã có bản ký|Cập nhật/ }).first().click()
    await expect(dialog().getByText('Bản hợp đồng đã ký').first()).toBeVisible()
    await dialog().getByLabel('Đã có bản hợp đồng ký 2 bên').check()
    await dialog().getByLabel('Nơi cất / ghi chú').fill('Bản giấy cất tủ hồ sơ khu A (test UAT)')
    await dialog().getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText('cất tủ hồ sơ khu A', { timeout: 10_000 })
    await expect(main().getByText('Thiếu tài liệu')).toHaveCount(0)
  })

  await run('Ký lại kèm chuyển cọc (B09)', async () => {
    await openContract('HD2026-0048')
    await page.getByRole('button', { name: /Ký lại/ }).first().click()
    await expect(dialog().getByText('Ký lại cho người còn ở').first()).toBeVisible()
    await page.waitForTimeout(600)
    const head = dialog().getByLabel('Người đứng tên mới')
    await head.selectOption(await head.locator('option:not([value=""])').first().getAttribute('value'))
    await dialog().getByLabel('Ngày bàn giao').fill(isoToday())
    const deposit = dialog().getByLabel(/Chuyển cọc đang giữ/)
    await expect(deposit, 'không có tùy chọn chuyển cọc sang hợp đồng mới').toBeVisible()
    await deposit.check()
    await shot('5-resign-deposit')
    await dialog().getByRole('button', { name: 'Ký lại', exact: true }).click()
    await page.waitForURL(/\/contracts\/[0-9a-f-]{36}\/edit$/, { timeout: 20_000 })
    await expect(page.getByText(/Đã tạo hợp đồng nháp mới/).first()).toBeVisible({ timeout: 10_000 })
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
