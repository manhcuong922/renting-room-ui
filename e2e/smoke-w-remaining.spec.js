import { expect, test } from '@playwright/test'

// Các luồng phụ còn lại: khoản phát sinh (thêm → hủy), báo trả phòng → rút báo, hủy hợp đồng nháp, công tơ (thay / tháo / lắp),
// khoản thu (thêm → ngừng dùng → khôi phục), nhóm phòng, ẩn danh người thuê, cài đặt tổ chức, hồ sơ cá nhân.
// GHI dữ liệu — chỉ chạy trên DB seed dùng một lần. Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-w-remaining.spec.js
const API = process.env.E2E_API_URL ?? 'http://localhost:5213/api/v1'
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.use({ actionTimeout: 15_000 })
test.setTimeout(300_000)

async function go(page, to) {
  await page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, to)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

const isoPlusDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

test('luồng phụ: phát sinh, báo trả phòng, hủy nháp, công tơ, khoản thu, nhóm phòng, ẩn danh, cài đặt', async ({ page, request }, testInfo) => {
  const issues = []
  let step = ''
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const shot = (name) => page.screenshot({ path: `test-results/rem-${name}.png`, fullPage: true })
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
  const toast = (re) => expect(page.getByText(re).first()).toBeVisible({ timeout: 15_000 })
  const unique = Date.now().toString().slice(-6)

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
  }
  const openRoom = async (code) => {
    await go(page, '/rooms')
    await page.getByLabel('Tìm mã phòng').fill(code).catch(() => page.getByPlaceholder('Tìm mã phòng…').fill(code))
    await page.waitForTimeout(900)
    await page.locator(`a[href^="/rooms/"]:has-text("${code}"):visible`).first().click()
    await page.waitForLoadState('networkidle')
  }
  const openPropertyTab = async (code, tab) => {
    await go(page, '/properties')
    await page.locator('a[href^="/properties/"]:not([href="/properties/new"])').filter({ hasText: new RegExp(`Khu ${code}|^${code}\\b`) }).first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await page.waitForLoadState('networkidle')
  }
  // Dòng / thẻ đang HIỂN THỊ chứa `text` và có nút `button` (bảng và thẻ mobile cùng tồn tại trong DOM, bản ẩn không được chọn).
  const rowOf = (text, button) =>
    page.locator('tr:visible, li:visible, article:visible, section:visible').filter({ hasText: text }).filter({ has: page.getByRole('button', { name: button }) }).last()
  const fillReasonAndConfirm = async (confirmName) => {
    const box = dialog().getByRole('textbox').first()
    if (await box.count()) await box.fill('Kiểm thử UAT')
    await dialog().getByRole('button', { name: confirmName }).last().click()
  }

  // ------------------------------------------------------------- Khoản phát sinh
  await run('Khoản phát sinh: thêm phụ thu', async () => {
    await openRoom('103')
    await page.getByRole('button', { name: 'Thêm phụ thu' }).click()
    await expect(dialog().getByText(/Thêm khoản phát sinh/)).toBeVisible()
    await dialog().getByLabel('Nội dung').fill(`Phụ thu kiểm thử ${unique}`)
    await dialog().getByLabel('Số tiền').fill('100000')
    await dialog().getByLabel('Lý do').fill('Kiểm thử UAT')
    await shot('1-charge-dialog')
    await dialog().getByRole('button', { name: 'Thêm khoản' }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(`Phụ thu kiểm thử ${unique}`, { timeout: 10_000 })
  })

  await run('Khoản phát sinh: hủy', async () => {
    await go(page, '/room-charges')
    await rowOf(`Phụ thu kiểm thử ${unique}`, 'Hủy').getByRole('button', { name: 'Hủy', exact: true }).click()
    await expect(dialog()).toBeVisible()
    await fillReasonAndConfirm(/^Hủy|Xác nhận/)
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(/Đã hủy/, { timeout: 10_000 })
  })

  // ------------------------------------------------------------- Báo trả phòng / rút báo
  await run('Báo trả phòng HD2026-0018', async () => {
    await openContract('HD2026-0018')
    await page.getByRole('button', { name: 'Báo trả phòng' }).first().click()
    await expect(dialog().getByText('Ghi nhận báo trả phòng')).toBeVisible()
    await dialog().getByLabel('Dự kiến trả phòng').fill(isoPlusDays(15))
    await shot('2-notice-dialog')
    await dialog().getByRole('button', { name: 'Ghi nhận', exact: true }).click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(/Đã báo trả phòng/, { timeout: 10_000 })
  })

  await run('Rút báo trả phòng', async () => {
    await page.getByRole('button', { name: /Rút báo trả phòng/ }).first().click()
    await expect(dialog()).toBeVisible()
    await dialog().getByRole('button', { name: 'Rút báo trả phòng' }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).not.toContainText(/Đã báo trả phòng/, { timeout: 10_000 })
  })

  // ------------------------------------------------------------- Hủy nháp
  await run('Hủy hợp đồng nháp HD2026-0010', async () => {
    await openContract('HD2026-0010')
    await page.getByRole('button', { name: 'Hủy nháp' }).first().click()
    await expect(dialog()).toBeVisible()
    await fillReasonAndConfirm('Hủy nháp')
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(/Đã hủy/, { timeout: 10_000 })
  })

  // ------------------------------------------------------------- Công tơ
  await run('Công tơ: thay công tơ điện phòng 106', async () => {
    await openRoom('106')
    await page.getByRole('button', { name: 'Thay', exact: true }).first().click()
    await expect(dialog().getByText(/Thay công tơ/).first()).toBeVisible()
    await dialog().getByLabel(/Số cuối công tơ cũ/).fill('9000')
    await dialog().getByLabel('Số serial công tơ mới').fill(`E-NEW-${unique}`)
    await dialog().getByLabel(/Chỉ số ban đầu công tơ mới/).fill('0')
    await shot('3-meter-replace')
    await dialog().getByRole('button', { name: 'Thay công tơ' }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(`E-NEW-${unique}`, { timeout: 10_000 })
  })

  await run('Công tơ: tháo công tơ nước rồi lắp lại', async () => {
    await rowOf(/Nước/, 'Tháo').getByRole('button', { name: 'Tháo' }).click()
    await expect(dialog().getByText(/Tháo công tơ/).first()).toBeVisible()
    await dialog().getByLabel('Số cuối').fill('9000')
    await dialog().getByRole('button', { name: 'Tháo công tơ' }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await page.getByRole('button', { name: 'Lắp công tơ' }).first().click()
    await expect(dialog().getByText(/Lắp công tơ/).first()).toBeVisible()
    const fee = dialog().getByLabel('Khoản thu')
    await fee.selectOption({ label: (await fee.locator('option').allTextContents()).find((t) => /Nước/.test(t)) })
    await dialog().getByLabel('Số serial').fill(`W-NEW-${unique}`)
    await dialog().getByLabel('Chỉ số ban đầu').fill('0')
    await dialog().getByRole('button', { name: 'Lắp công tơ' }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(`W-NEW-${unique}`, { timeout: 10_000 })
  })

  // ------------------------------------------------------------- Khoản thu
  const feeName = `Gửi xe ô tô ${unique}`
  await run('Khoản thu: thêm', async () => {
    await openPropertyTab('A', 'Khoản thu')
    await page.getByRole('button', { name: 'Thêm khoản thu' }).click()
    await expect(dialog().getByText('Thêm khoản thu').first()).toBeVisible()
    await dialog().getByLabel('Tên khoản thu').fill(feeName)
    await dialog().getByLabel('Đơn vị').fill('xe')
    await dialog().getByLabel('Đơn giá').fill('200000')
    await shot('4-fee-dialog')
    await dialog().locator('button[type="submit"]').click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(feeName, { timeout: 10_000 })
  })

  await run('Khoản thu: ngừng dùng → khôi phục', async () => {
    await rowOf(feeName, 'Ngừng dùng').getByRole('button', { name: 'Ngừng dùng' }).click()
    await expect(dialog()).toBeVisible()
    await dialog().getByRole('button', { name: /Ngừng dùng|Xác nhận/ }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await page.getByRole('checkbox', { name: /Hiện cả khoản ngừng dùng/ }).check()
    await rowOf(feeName, 'Khôi phục').getByRole('button', { name: 'Khôi phục' }).click()
    await dialog().getByRole('button', { name: /Khôi phục|Xác nhận/ }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
  })

  // ------------------------------------------------------------- Nhóm phòng
  const groupName = `Tầng 2 kiểm thử ${unique}`
  await run('Nhóm phòng: tạo → gán phòng → xóa', async () => {
    await openPropertyTab('A', 'Nhóm phòng')
    await page.getByRole('button', { name: 'Tạo nhóm' }).click()
    await dialog().getByLabel('Tên nhóm').fill(groupName)
    await dialog().locator('button[type="submit"]').click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await expect(main()).toContainText(groupName, { timeout: 10_000 })
    await rowOf(groupName, 'Chọn phòng').getByRole('button', { name: 'Chọn phòng' }).click()
    await expect(dialog().getByText(/Phòng trong nhóm/)).toBeVisible()
    await dialog().getByRole('checkbox').first().check()
    await dialog().getByRole('button', { name: /^Lưu/ }).last().click()
    await expect(dialog()).toHaveCount(0, { timeout: 15_000 })
    await rowOf(groupName, 'Xóa').getByRole('button', { name: 'Xóa' }).click()
    await dialog().getByRole('button', { name: /Xóa/ }).last().click()
    await expect(main()).not.toContainText(groupName, { timeout: 10_000 })
  })

  // ------------------------------------------------------------- Ẩn danh người thuê
  await run('Ẩn danh người thuê (không còn hợp đồng)', async () => {
    const token = (await (await request.post(`${API}/auth/login`, { data: { username: OWNER.phone, password: OWNER.password } })).json()).accessToken
    const list = (await (await request.get(`${API}/renters?pageSize=100&staying=false`, { headers: { Authorization: `Bearer ${token}` } })).json()).items.filter((r) => !r.anonymizedAt && !r.archivedAt)
    expect(list.length, 'không có người thuê đã chuyển đi để ẩn danh').toBeGreaterThan(0)
    const blocked = []
    let done = false
    for (const renter of list.slice(0, 6)) {
      await go(page, `/renters/${renter.id}`)
      await page.getByRole('button', { name: 'Ẩn danh', exact: true }).click()
      await dialog().getByRole('button', { name: 'Tiếp tục' }).click()
      await expect(dialog().getByText(/Xác nhận lần 2/)).toBeVisible()
      await dialog().getByRole('textbox').first().fill('Kiểm thử UAT')
      await dialog().getByLabel(/Gõ/).fill(renter.fullName)
      await dialog().getByRole('button', { name: 'Ẩn danh vĩnh viễn' }).click()
      await page.waitForTimeout(1500)
      if ((await page.locator('dialog[open]').count()) === 0) {
        done = true
        break
      }
      blocked.push(`${renter.fullName}: ${(await dialog().innerText()).replace(/\s+/g, ' ').slice(0, 150)}`)
      await page.keyboard.press('Escape')
    }
    expect(done, `không ai ẩn danh được: ${blocked.join(' || ')}`).toBe(true)
    await shot('5-anonymized')
  })

  // ------------------------------------------------------------- Cài đặt tổ chức + hồ sơ
  await run('Cài đặt tổ chức: sửa thông tin liên hệ', async () => {
    await go(page, '/organization')
    await page.getByLabel('Người liên hệ').fill(`Liên hệ kiểm thử ${unique}`)
    await page.getByRole('button', { name: /^Lưu/ }).first().click()
    await toast(/Đã lưu|đã cập nhật|Đã cập nhật/i)
    await go(page, '/organization')
    await expect(page.getByLabel('Người liên hệ')).toHaveValue(`Liên hệ kiểm thử ${unique}`)
  })

  await run('Cài đặt tổ chức: thời gian giữ dữ liệu', async () => {
    await page.getByRole('tab', { name: /Dữ liệu|Lưu trữ|Giữ/ }).first().click()
    await expect(page.getByLabel('Giữ dữ liệu người thuê').first()).toBeVisible()
    await shot('6-retention')
  })

  await run('Hồ sơ cá nhân: sửa email', async () => {
    await go(page, '/profile')
    await page.getByRole('button', { name: /Sửa/ }).first().click()
    await dialog().getByLabel('Email').fill(`chutro.${unique}@example.com`)
    const current = dialog().getByLabel('Mật khẩu hiện tại')
    if (await current.count()) await current.fill(OWNER.password)
    await dialog().locator('button[type="submit"]').click()
    // Đổi email / SĐT (tên đăng nhập) ⇒ mọi phiên bị vô hiệu, UI đưa về màn đăng nhập (docs/api/auth.md).
    await page.waitForURL(/\/login/, { timeout: 15_000 })
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
