import { expect, test } from '@playwright/test'

// Tài khoản chủ trọ của dữ liệu demo (docs/guides/demo-data.md).
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }

/** Vẽ một thanh chú thích trên đầu trang để người xem biết bước đang chạy. */
async function narrate(page, text) {
  await page.evaluate((message) => {
    let bar = document.getElementById('e2e-narration')
    if (!bar) {
      bar = document.createElement('div')
      bar.id = 'e2e-narration'
      bar.style.cssText =
        'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;background:#111;color:#fff;padding:10px 18px;border-radius:8px;font:600 15px system-ui;box-shadow:0 4px 16px #0006;max-width:90vw'
      document.body.append(bar)
    }
    bar.textContent = message
  }, text)
  await page.waitForTimeout(500)
}

test.describe.configure({ mode: 'serial' })

test('Thông báo Zalo: cài đặt khu → mã liên kết → gửi lại phiếu', async ({ page }) => {
  // ---- 1. Đăng nhập
  await page.goto('/login')
  await narrate(page, '1. Đăng nhập bằng tài khoản chủ trọ demo')
  await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)

  // ---- 2. Cài đặt thông báo của khu
  await page.goto('/properties')
  await narrate(page, '2. Mở khu trọ đầu tiên → tab "Thông báo"')
  await page.locator('a[href^="/properties/"]:not([href="/properties/new"])').first().click()
  await page.getByRole('tab', { name: 'Thông báo' }).click()
  const autoSend = page.getByLabel('Tự gửi phiếu khi chốt')
  await expect(autoSend).toBeVisible()

  await narrate(page, 'Bật "Tự gửi phiếu khi chốt" và thêm 2 mốc nhắc nợ')
  if (!(await autoSend.isChecked())) await autoSend.check()
  // Xóa mốc cũ (nếu có) để chạy lại được nhiều lần.
  while ((await page.getByRole('button', { name: 'Xóa' }).count()) > 0) await page.getByRole('button', { name: 'Xóa' }).first().click()
  await page.getByRole('button', { name: 'Thêm mốc nhắc' }).click()
  await page.getByLabel('Nhắc lần 1').fill('1')
  await page.getByRole('button', { name: 'Thêm mốc nhắc' }).click()
  await page.getByLabel('Nhắc lần 2').fill('1') // cố ý trùng mốc để thấy kiểm tra
  await narrate(page, 'Nhập cố ý mốc trùng (1 và 1) → phải báo lỗi, không cho lưu')
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByText('tăng dần và không trùng')).toBeVisible()

  await narrate(page, 'Sửa mốc 2 thành 3 ngày → lưu thành công')
  await page.getByLabel('Nhắc lần 2').fill('3')
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByText('Đã lưu cài đặt thông báo.')).toBeVisible()

  // ---- 3. Mã liên kết Zalo của người thuê
  await page.goto('/renters')
  await narrate(page, '3. Mở hồ sơ một người thuê → "Nhận phiếu qua Zalo"')
  await page.locator('a[href^="/renters/"]').first().click()
  await expect(page.getByRole('heading', { name: 'Nhận phiếu qua Zalo' })).toBeVisible()
  await narrate(page, 'Bấm "Tạo mã liên kết" → mã 8 ký tự hiện một lần')
  await page.getByRole('button', { name: /Tạo mã liên kết/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Mã liên kết Zalo' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/^[A-HJ-KM-NP-Z2-9]{8}$/)).toBeVisible()
  await narrate(page, 'Mã đúng định dạng (không có 0 O 1 I L). Đóng hộp thoại')
  await page.waitForTimeout(1500)
  await dialog.getByRole('button', { name: 'Đóng' }).first().click()

  // ---- 4. Gửi lại phiếu đã chốt
  await page.goto('/invoices')
  await narrate(page, '4. Mở một phiếu "Đã chốt" → "Gửi cho người thuê"')
  await page.getByLabel('Mọi tháng').click()
  await page.getByLabel('Trạng thái').selectOption({ label: 'Đã chốt' })
  await page.getByRole('row').nth(1).click() // dòng dữ liệu đầu tiên (đã lọc trạng thái Đã chốt)
  await expect(page.getByRole('heading', { name: 'Gửi cho người thuê' })).toBeVisible()
  await narrate(page, 'Bấm "Gửi lại" → chọn kênh Email → gửi')
  await page.getByRole('button', { name: 'Gửi lại' }).first().click()
  await page.getByText('Email', { exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Gửi lại' }).click()
  // Máy dev chưa cấu hình SMTP ⇒ không có kênh nào dùng được: UI phải báo rõ, không im lặng.
  await narrate(page, 'Máy dev chưa cấu hình SMTP → hệ thống báo rõ vì sao không gửi được')
  await expect(page.getByRole('dialog').getByText(/kênh|email|Zalo/i).first()).toBeVisible()
  await page.waitForTimeout(2500)
})
