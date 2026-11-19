import { expect, test } from '@playwright/test'

// Các tab của chi tiết hợp đồng + hồ sơ người thuê, trên UI thật: tài sản (HĐ nháp: thêm → sửa → xóa), xe (đăng ký → kết thúc gửi),
// người ở (thêm → chuyển đi), giá thuê (phụ lục), khoản thu của hợp đồng (gắn → thôi tính); người thuê: ghi nhận / rút lại đồng ý,
// xem số giấy tờ đầy đủ. GHI dữ liệu — chỉ chạy trên DB seed dùng một lần. Dùng HĐ A·208 (HD2026-0013, đang hiệu lực).
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-x-contract-tabs.spec.js   (API :5213 vừa seed + UI :5173)
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])
const CONTRACT_NO = 'HD2026-0013'

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

const isoPlusDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

test('tab hợp đồng: tài sản, xe, người ở, giá thuê, khoản thu; người thuê: đồng ý, xem giấy tờ', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/tabs-${name}.png`, fullPage: true })
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
  const unique = Date.now().toString().slice(-6)

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  const openContractTab = async (tab, no = CONTRACT_NO) => {
    await go(page, '/contracts')
    await page.getByLabel('Tìm số hợp đồng').fill(no)
    await page.waitForTimeout(900)
    await page.locator(`a[href^="/contracts/"]:has-text("${no}"):visible`).first().click()
    await page.waitForLoadState('networkidle')
    await expect(main()).toContainText(no)
    if (tab) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
      await page.waitForTimeout(400)
    }
  }
  const rowOf = (text, button) =>
    page.locator('tr:visible, li:visible, article:visible').filter({ hasText: text }).filter({ has: page.getByRole('button', { name: button }) }).last()

  // ---------------------------------------------------------------- Tài sản (chỉ HĐ nháp: kích hoạt rồi thì không sửa được)
  const DRAFT_NO = 'HD2026-0014'
  await run('Tài sản (HĐ nháp): thêm', async () => {
    await openContractTab('Tài sản', DRAFT_NO)
    await page.getByRole('button', { name: 'Thêm tài sản' }).click()
    await expect(dialog().getByText('Thêm tài sản bàn giao').first()).toBeVisible()
    await dialog().getByLabel('Tên tài sản').fill(`Tủ lạnh ${unique}`)
    await dialog().getByLabel('Giá trị ước tính').fill('2500000')
    await dialog().getByLabel('Tình trạng khi bàn giao').fill('Mới, chạy tốt')
    await shot('1-asset-dialog')
    await dialog().locator('button[type="submit"]').click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(`Tủ lạnh ${unique}`, { timeout: 10_000 })
  })

  await run('Tài sản (HĐ nháp): sửa → xóa', async () => {
    await rowOf(`Tủ lạnh ${unique}`, /Sửa/).getByRole('button', { name: /Sửa/ }).click()
    await expect(dialog().getByText(/^Sửa Tủ lạnh/).first()).toBeVisible()
    await dialog().getByLabel('Tình trạng khi bàn giao').fill('Đã sửa tình trạng')
    await dialog().locator('button[type="submit"]').click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText('Đã sửa tình trạng', { timeout: 10_000 })
    await rowOf(`Tủ lạnh ${unique}`, /Xóa/).getByRole('button', { name: /Xóa/ }).click()
    await expect(dialog()).toBeVisible()
    await dialog().getByRole('button', { name: 'Xóa', exact: true }).last().click()
    await expect(main()).not.toContainText(`Tủ lạnh ${unique}`, { timeout: 10_000 })
  })

  // ---------------------------------------------------------------- Xe
  await run('Xe: đăng ký → kết thúc gửi', async () => {
    await openContractTab('Xe')
    await page.getByRole('button', { name: 'Đăng ký xe' }).click()
    await expect(dialog().getByText('Đăng ký xe').first()).toBeVisible()
    await dialog().getByLabel('Biển số').fill(`29A-${unique.slice(0, 3)}.${unique.slice(3)}`)
    await dialog().getByLabel('Hiệu / màu').fill('Honda Vision đỏ')
    await shot('2-vehicle-dialog')
    await dialog().getByRole('button', { name: 'Đăng ký', exact: true }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText('Honda Vision đỏ', { timeout: 10_000 })
    await rowOf('Honda Vision đỏ', 'Kết thúc gửi').getByRole('button', { name: 'Kết thúc gửi' }).click()
    await expect(dialog()).toBeVisible()
    await dialog().locator('button[type="submit"]').click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
  })

  // ---------------------------------------------------------------- Người ở
  await run('Người ở: thêm người ở', async () => {
    await openContractTab('Người ở')
    await page.getByRole('button', { name: 'Thêm người ở' }).click()
    await expect(dialog().getByText('Thêm người ở').first()).toBeVisible()
    await dialog().getByRole('combobox').fill('Âu')
    await dialog().getByRole('option').first().click()
    await dialog().getByLabel('Ngày vào ở').fill(isoPlusDays(-1))
    const relation = dialog().getByLabel('Quan hệ với chủ hộ')
    if (await relation.count()) await relation.selectOption({ index: 1 })
    await shot('3-occupant-dialog')
    await dialog().getByRole('button', { name: 'Thêm người ở' }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
  })

  await run('Người ở: ghi nhận chuyển đi', async () => {
    const leave = page.getByRole('button', { name: /Chuyển đi|Ghi nhận chuyển đi|Rời/ }).filter({ hasNotText: /Chuyển sang/ }).last()
    await leave.click()
    await expect(dialog().getByText(/chuyển đi/).first()).toBeVisible()
    await dialog().getByLabel('Ngày chuyển đi').fill(isoPlusDays(0))
    await dialog().getByRole('button', { name: 'Ghi nhận chuyển đi' }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
  })

  // ---------------------------------------------------------------- Giá thuê (phụ lục)
  await run('Giá thuê: sửa giá có phụ lục', async () => {
    await openContractTab()
    await page.getByRole('button', { name: 'Sửa giá thuê' }).first().click()
    await expect(dialog().getByText('Sửa giá thuê').first()).toBeVisible()
    await dialog().getByLabel('Giá thuê mới / tháng').fill('3300000')
    await dialog().getByLabel('Số phụ lục').fill('PL01')
    await shot('4-rent-dialog')
    await dialog().getByRole('button', { name: 'Lưu giá mới' }).click()
    await expect(dialog(), 'sửa giá không đóng được hộp thoại (có thể cần chọn kỳ áp dụng)').toHaveCount(0, { timeout: 15_000 })
    await page.getByRole('tab', { name: /^Giá thuê/ }).click()
    await expect(main()).toContainText('PL01', { timeout: 10_000 })
  })

  // ---------------------------------------------------------------- Khoản thu của hợp đồng
  await run('Khoản thu hợp đồng: gắn → thôi tính', async () => {
    await openContractTab('Khoản thu')
    const add = page.getByRole('button', { name: /Thêm|Gắn/ }).first()
    await add.click()
    await expect(dialog().getByText('Gắn thêm khoản thu').first()).toBeVisible()
    const fee = dialog().getByLabel('Khoản thu')
    const options = await fee.locator('option:not([value=""])').allTextContents()
    expect(options.length, 'không còn khoản thu nào để gắn').toBeGreaterThan(0)
    await fee.selectOption({ label: options[0] })
    await shot('5-contract-fee-dialog')
    await dialog().getByRole('button', { name: 'Gắn khoản thu' }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await page.locator('tr:visible, li:visible').filter({ hasText: options[0].split(' (')[0] }).last().getByRole('button', { name: /Thôi tính|Bỏ|Xóa/ }).first().click().catch(() => {})
    if (await dialog().count()) {
      await dialog().locator('button[type="submit"]').click()
      await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    }
  })

  // ---------------------------------------------------------------- Người thuê: đồng ý + xem giấy tờ
  await run('Người thuê: ghi nhận → rút lại đồng ý', async () => {
    await go(page, '/renters')
    await page.locator('a[href^="/renters/"]:visible').first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Ghi nhận đồng ý' }).click()
    await expect(dialog().getByText('Ghi nhận đồng ý').first()).toBeVisible()
    await dialog().getByLabel('Mục đích').fill(`Quản lý hợp đồng ${unique}`)
    await dialog().getByRole('button', { name: 'Ghi nhận', exact: true }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(`Quản lý hợp đồng ${unique}`, { timeout: 10_000 })
    await rowOf(`Quản lý hợp đồng ${unique}`, /Rút/).getByRole('button', { name: /Rút/ }).click()
    await dialog().getByRole('button', { name: 'Ghi nhận rút lại' }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(/rút lại|Đã rút/i, { timeout: 10_000 })
  })

  await run('Người thuê: xem số giấy tờ đầy đủ', async () => {
    const reveal = page.getByRole('button', { name: 'Hiện số giấy tờ' }).first()
    await expect(reveal).toBeVisible()
    const before = await main().innerText()
    await reveal.click()
    await expect(page.getByRole('button', { name: 'Ẩn số giấy tờ' }).first()).toBeVisible({ timeout: 10_000 })
    expect(await main().innerText(), 'số giấy tờ không đổi sau khi bấm Hiện').not.toEqual(before)
    await shot('6-id-revealed')
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
