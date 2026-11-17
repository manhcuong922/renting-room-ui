import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

// Các luồng còn lại: nhập Excel (phòng → người thuê), xuất Excel / tải .docx, mẫu hợp đồng (tạo → dùng trong wizard → lưu trữ),
// quản lý thành viên (thêm → giao khu → khóa → mở khóa → gỡ), tạo khu + tạo phòng (lẻ + hàng loạt), trang Tổng quan.
// GHI dữ liệu — chỉ chạy trên DB seed dùng một lần. Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-v-more.spec.js
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
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

test('nhập/xuất Excel, mẫu hợp đồng, thành viên, tạo khu & phòng, tổng quan', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/more-${name}.png`, fullPage: true })
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
  const dialog = () => page.locator('dialog[open]')
  const main = () => page.locator('main')
  const unique = Date.now().toString().slice(-6)

  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  // ---------------------------------------------------------------- Nhập Excel
  await run('Nhập Excel: phòng', async () => {
    await go(page, '/properties')
    await page.locator('a[href^="/properties/"]:not([href="/properties/new"])').filter({ hasText: /Khu A|^A\b|Thu sau/ }).first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: 'Nhập Excel' }).click()
    await expect(page.getByText('1. Nhập phòng')).toBeVisible()
    const input = page.locator('input[type="file"][accept=".xlsx"]').first()
    await input.setInputFiles(path.join(FIXTURES, 'import-rooms.xlsx'))
    await expect(page.getByText(/Đã đọc 3 dòng/).first()).toBeVisible({ timeout: 20_000 })
    await shot('1-import-rooms-preview')
    await page.getByRole('button', { name: /^Lưu \d+ dòng$/ }).first().click()
    await expect(page.getByText(/Đã lưu|lưu xong|đã lưu/i).first()).toBeVisible({ timeout: 25_000 })
    await shot('2-import-rooms-saved')
    // Dòng thiếu mã phòng còn lại phải nói rõ vì sao chưa lưu — không được hiện nhãn "Hợp lệ" mà thiếu lý do.
    const leftover = page.locator('tr', { hasText: /^7/ }).first()
    await expect(leftover).toContainText(/bắt buộc|Mã phòng/)
    await expect(leftover).not.toContainText('Hợp lệ')
  })

  await run('Nhập Excel: người thuê đang ở', async () => {
    const input = page.locator('input[type="file"][accept=".xlsx"]').nth(1)
    await input.setInputFiles(path.join(FIXTURES, 'import-tenancies.xlsx'))
    await expect(page.getByText(/Đã đọc 3 dòng/).first()).toBeVisible({ timeout: 20_000 })
    await shot('3-import-tenancies-preview')
    await page.getByRole('button', { name: /^Lưu \d+ dòng$/ }).last().click()
    await expect(page.getByText(/Đã lưu|lưu xong|đã lưu/i).first()).toBeVisible({ timeout: 25_000 })
    await shot('4-import-tenancies-saved')
  })

  await run('Nhập Excel: phòng T01 có hợp đồng đang hiệu lực', async () => {
    await go(page, '/contracts')
    await page.getByLabel('Tìm số hợp đồng').fill('')
    await page.getByRole('tab', { name: 'Đang hiệu lực' }).click()
    await page.waitForLoadState('networkidle')
    await expect(main()).toContainText('T01', { timeout: 10_000 })
    await expect(main()).toContainText('Phạm Thị Nhập Thử')
  })

  // ---------------------------------------------------------------- Xuất file
  await run('Xuất Excel phiếu tiền phòng', async () => {
    await go(page, '/invoices')
    await page.getByRole('button', { name: 'Xuất Excel' }).click()
    await expect(dialog()).toBeVisible()
    await shot('5-export-invoices-dialog')
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      dialog().getByRole('button', { name: /Xuất|Tải/ }).last().click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i)
    const file = await download.path()
    expect(file, 'tệp tải về rỗng').toBeTruthy()
    await page.keyboard.press('Escape')
  })

  await run('Tải .docx hợp đồng', async () => {
    await go(page, '/contracts')
    await page.getByLabel('Tìm số hợp đồng').fill('HD2026-0001')
    await page.waitForTimeout(900)
    await page.locator('a[href^="/contracts/"]:has-text("HD2026-0001"):visible').first().click()
    await page.waitForLoadState('networkidle')
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.getByRole('button', { name: /Tải \.docx/ }).first().click()])
    expect(download.suggestedFilename()).toMatch(/\.docx$/i)
  })

  await run('Xuất người thuê (Excel)', async () => {
    await go(page, '/renters')
    const exportButton = page.getByRole('button', { name: /Xuất/ }).first()
    await expect(exportButton, 'không thấy nút xuất ở trang Người thuê').toBeVisible()
    await exportButton.click()
    await expect(dialog()).toBeVisible()
    await shot('6-export-renters-dialog')
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), dialog().getByRole('button', { name: /^Xuất/ }).last().click()])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i)
    await page.keyboard.press('Escape')
  })

  // ---------------------------------------------------------------- Mẫu hợp đồng
  const templateName = `Mẫu kiểm thử ${unique}`
  await run('Mẫu hợp đồng: tạo từ mẫu gợi ý', async () => {
    await go(page, '/contract-templates')
    await page.getByRole('button', { name: 'Tạo mẫu' }).click()
    await expect(dialog().getByText('Tạo mẫu hợp đồng').first()).toBeVisible()
    await dialog().locator('button[class*="preset"]').first().click()
    await page.waitForURL(/\/contract-templates\/new/, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Tên mẫu').fill(templateName)
    await shot('7-template-editor')
    await page.getByRole('button', { name: /^Lưu|^Tạo mẫu/ }).last().click()
    await page.waitForURL(/\/contract-templates\/[0-9a-f-]{36}/, { timeout: 15_000 }) // lưu xong mở luôn mẫu vừa tạo
    await go(page, '/contract-templates')
    await expect(main()).toContainText(templateName, { timeout: 10_000 })
  })

  await run('Mẫu hợp đồng: có trong bước "Mẫu" của wizard', async () => {
    await go(page, '/contracts/new')
    await expect(page.getByText(templateName).first()).toBeVisible({ timeout: 10_000 })
  })

  // ---------------------------------------------------------------- Thành viên
  const managerName = `Quản Lý Kiểm Thử ${unique}`
  await run('Thành viên: thêm quản lý khu', async () => {
    await go(page, '/members')
    await page.getByRole('button', { name: 'Thêm quản lý khu' }).click()
    await dialog().getByLabel('Họ tên').fill(managerName)
    await dialog().getByLabel('Số điện thoại').fill(`09${unique}00`)
    const firstProperty = dialog().getByRole('checkbox').first()
    if (await firstProperty.count()) await firstProperty.check()
    await shot('8-member-dialog')
    await dialog().getByRole('button', { name: /^Thêm|^Lưu|^Tạo/ }).last().click()
    // Mật khẩu tạm hiện đúng một lần.
    await expect(page.getByText(/Mật khẩu tạm/).first()).toBeVisible({ timeout: 15_000 })
    await shot('9-member-temp-password')
    // Mật khẩu tạm chỉ hiện một lần nên Esc không đóng — phải bấm xác nhận đã lưu.
    await page.getByRole('button', { name: 'Tôi đã lưu lại' }).click()
    await expect(dialog()).toHaveCount(0)
    await expect(main()).toContainText(managerName, { timeout: 10_000 })
  })

  await run('Thành viên: khóa → mở khóa → gỡ', async () => {
    const card = page.locator('tr', { hasText: managerName })
    await card.getByRole('button', { name: 'Khóa', exact: true }).click()
    await dialog().getByRole('button', { name: /Khóa/ }).last().click()
    await expect(page.getByText(/Đã khóa/).first()).toBeVisible({ timeout: 10_000 })
    await card.getByRole('button', { name: /Mở khóa/ }).first().click()
    await expect(page.getByText(/Đã mở khóa|mở khóa/i).first()).toBeVisible({ timeout: 10_000 })
    await card.getByRole('button', { name: /Gỡ/ }).first().click()
    // Gỡ vĩnh viễn: phải gõ lại đúng họ tên để mở nút xác nhận.
    await expect(dialog().getByRole('button', { name: /Gỡ vĩnh viễn/ })).toBeDisabled()
    await dialog().getByRole('textbox').fill(managerName)
    await dialog().getByRole('button', { name: /Gỡ vĩnh viễn/ }).click()
    await expect(main()).not.toContainText(managerName, { timeout: 10_000 })
  })

  // ---------------------------------------------------------------- Tạo khu + phòng
  const propertyCode = `K${unique}`
  await run('Tạo khu trọ mới', async () => {
    await go(page, '/properties/new')
    await page.getByLabel('Mã khu').fill(propertyCode)
    await page.getByLabel('Tên khu').fill(`Khu kiểm thử ${unique}`)
    await page.getByLabel('Số nhà, ngõ, đường').fill('99 Đường Kiểm Thử')
    // Tỉnh / xã là ô gõ-để-tìm bắt buộc: gõ rồi chọn kết quả đầu tiên.
    await page.getByLabel('Tỉnh / thành phố').fill('Ha noi')
    await page.getByRole('option').first().click()
    await page.getByLabel('Xã / phường').click()
    await page.getByRole('option').first().click()
    await shot('10-property-form')
    await page.getByRole('button', { name: /^Tạo khu|^Lưu/ }).last().click()
    await page.waitForURL(/\/properties\/[0-9a-f-]{36}/, { timeout: 20_000 })
    await expect(main()).toContainText(propertyCode)
  })

  await run('Tạo phòng hàng loạt trong khu mới', async () => {
    await page.getByRole('tab', { name: 'Phòng', exact: true }).click()
    await page.getByRole('button', { name: 'Tạo hàng loạt' }).click()
    await expect(dialog()).toBeVisible()
    // Nút Tạo chỉ mở khi đã khai số tầng / số phòng mỗi tầng.
    await dialog().getByLabel('Từ tầng').fill('1')
    await dialog().getByLabel('Số tầng').fill('2')
    await dialog().getByLabel('Số phòng mỗi tầng').fill('3')
    await dialog().getByRole('button', { name: /Sinh mã phòng/ }).click()
    await shot('11-bulk-rooms-dialog')
    await dialog().getByRole('button', { name: /^Tạo|^Thêm|^Lưu/ }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 20_000 })
    await page.waitForLoadState('networkidle')
    await expect(main()).toContainText(/Phòng|101|Tầng/, { timeout: 10_000 })
    await shot('12-bulk-rooms-done')
  })

  // ---------------------------------------------------------------- Tổng quan
  await run('Trang Tổng quan: số liệu hợp lệ', async () => {
    await go(page, '/dashboard')
    const text = await main().innerText()
    expect(text, 'có NaN / undefined / null trên Tổng quan').not.toMatch(/\bNaN\b|\bundefined\b|\bnull\b|Invalid Date/)
    await shot('13-dashboard')
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
