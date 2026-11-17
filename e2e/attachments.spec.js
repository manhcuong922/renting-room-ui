import { expect, test } from '@playwright/test'

// Tài khoản chủ trọ của dữ liệu demo (docs/guides/demo-data.md).
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }

// PNG 1×1 hợp lệ — đủ magic bytes để BE nhận (kiểm theo nội dung, không theo đuôi file).
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

test.describe.configure({ mode: 'serial' })

// Đăng nhập MỘT lần cho cả bộ (BE giới hạn 5 lần đăng nhập / phút / tài khoản — mỗi test tự đăng nhập sẽ bị chặn khi chạy lại liên tiếp).
let page
test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage()
  await login(page)
})
test.afterAll(async () => {
  await page.context().close()
})

// Tên tệp duy nhất mỗi lần chạy — lần chạy trước bị dừng giữa chừng không làm lần sau trùng tệp.
const stamp = Date.now()
const name = (prefix) => `${prefix}-${stamp}.png`

async function login(page) {
  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)
}

async function upload(page, categoryLabel, fileName) {
  // `page` có thể là Page hoặc Locator của hộp thoại — cả hai đều có getByLabel / getByTestId.
  const category = page.getByLabel('Loại tài liệu')
  if (await category.count()) await category.selectOption({ label: categoryLabel })
  await page.getByTestId('attachment-file-input').setInputFiles({ name: fileName, mimeType: 'image/png', buffer: PNG_1X1 })
}

test('Ảnh phòng: tải lên → hiện ảnh → xem to → xóa', async () => {
  await page.goto('/rooms')
  await page.locator('a[href^="/rooms/"]').first().click()
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Ảnh phòng' }) })
  await expect(section).toBeVisible()

  await upload(page, 'Ảnh phòng', name('phong'))
  await expect(section.getByText(name('phong'))).toBeVisible()
  // Ảnh không nhạy cảm tự hiện thumbnail: phải tải thật (naturalWidth > 0), không phải ảnh vỡ.
  const thumb = section.locator('img').first()
  await expect(thumb).toBeVisible()
  await expect.poll(() => thumb.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0)

  await section.getByRole('button', { name: `Xem ${name('phong')}` }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('img')).toBeVisible()
  await dialog.locator('footer').getByRole('button', { name: 'Đóng' }).click()

  await section.locator('li', { hasText: name('phong') }).getByRole('button', { name: 'Xóa' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa' }).click()
  await expect(section.getByText(name('phong'))).toHaveCount(0)
})

test('Giấy tờ người thuê: tải CCCD (nhạy cảm) → chỉ xem khi bấm → tải lại thì thay tệp cũ', async () => {
  await page.goto('/renters')
  await page.locator('a[href^="/renters/"]').first().click()
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Giấy tờ và ảnh' }) })
  await expect(section).toBeVisible()

  await upload(page, 'CCCD mặt trước', name('cccd1'))
  await expect(section.getByText(name('cccd1'))).toBeVisible()
  await expect(section.getByText('Nhạy cảm').first()).toBeVisible()
  // Ảnh giấy tờ KHÔNG tự tải thumbnail (mỗi lần tải được ghi nhật ký) — chỉ có biểu tượng khóa.
  await expect(section.locator('img')).toHaveCount(0)

  await section.getByRole('button', { name: `Xem ${name('cccd1')}` }).first().click()
  await expect(page.getByRole('dialog').locator('img')).toBeVisible()
  await page.getByRole('dialog').locator('footer').getByRole('button', { name: 'Đóng' }).click()

  // CCCD mặt trước chỉ giữ 1 tệp: tải tệp khác ⇒ tệp cũ biến mất.
  await upload(page, 'CCCD mặt trước', name('cccd2'))
  await expect(section.getByText(name('cccd2'))).toBeVisible()
  await expect(section.getByText(name('cccd1'))).toHaveCount(0)

  // Dọn để chạy lại được nhiều lần.
  await section.locator('li', { hasText: name('cccd2') }).getByRole('button', { name: 'Xóa' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa' }).click()
  await expect(section.getByText(name('cccd2'))).toHaveCount(0)
})

test('Tài liệu của khu: tab Tài liệu tải được giấy tờ', async () => {
  await page.goto('/properties')
  await page.locator('a[href^="/properties/"]:not([href="/properties/new"])').first().click()
  await page.getByRole('tab', { name: 'Tài liệu' }).click()
  await upload(page, 'Giấy tờ PCCC / pháp lý', name('pccc'))
  await expect(page.getByText(name('pccc'))).toBeVisible()
  await page.locator('li', { hasText: name('pccc') }).getByRole('button', { name: 'Xóa' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa' }).click()
  await expect(page.getByText(name('pccc'))).toHaveCount(0)
})

// Phòng 101 của dữ liệu demo có phiếu thu và công tơ điện / nước.
async function openRoom101(page) {
  await page.goto('/rooms')
  await page.getByRole('link', { name: /101/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Ảnh phòng' })).toBeVisible()
}

test('Chứng từ phiếu thu: tải lên được, không có nút xóa (chứng từ không xóa được)', async () => {
  await openRoom101(page)
  await page.getByRole('button', { name: 'Chứng từ' }).first().click()
  const dialog = page.getByRole('dialog')
  await upload(dialog, 'Chứng từ chuyển khoản', name('ck'))
  await expect(dialog.getByText(name('ck'))).toBeVisible()
  await expect(dialog.locator('li', { hasText: name('ck') }).getByRole('button', { name: 'Xóa' })).toHaveCount(0)
  await dialog.locator('footer').getByRole('button', { name: 'Đóng' }).click()
})

test('Ảnh công tơ: mở từ lịch sử chỉ số, tải lên được, không có nút xóa', async () => {
  await openRoom101(page)
  await page.getByRole('button', { name: 'Lịch sử' }).first().click()
  await page.getByRole('button', { name: 'Ảnh' }).first().click()
  const dialog = page.getByRole('dialog').last()
  await upload(dialog, 'Ảnh công tơ', name('ct'))
  await expect(dialog.getByText(name('ct'))).toBeVisible()
  await expect(dialog.locator('li', { hasText: name('ct') }).getByRole('button', { name: 'Xóa' })).toHaveCount(0)
})
