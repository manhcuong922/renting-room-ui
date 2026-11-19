import { expect, test } from '@playwright/test'

// Cài đặt khu (kỳ thu, ngân hàng, nội quy), bộ lọc nhật ký thao tác, và bảo mật tài khoản: quản lý đổi mật khẩu (sai → đúng → đăng nhập
// bằng mật khẩu mới), khóa theo IP sau nhiều lần sai + chủ trọ cấp lại mật khẩu, nhật ký đăng nhập, đăng xuất mọi thiết bị.
// GHI dữ liệu — chỉ chạy trên DB seed dùng một lần. Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-v4-settings-security.spec.js
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const MANAGER_PWD = { phone: '0900000007', password: 'PhoQuanLy2026', next: 'MatKhauMoi#Quan2026' }
const MANAGER_LOCK = { phone: '0900000008', password: 'PhoQuanLy2026' }
const IGNORED_STATUS = new Set([400, 401, 403, 404, 409, 422, 423, 429])

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

test('cài đặt khu, nhật ký, đổi mật khẩu, khóa tài khoản, đăng xuất mọi thiết bị', async ({ page, browser }, testInfo) => {
  const issues = []
  let step = ''
  const watch = (p) => {
    p.on('console', (m) => m.type() === 'error' && !/status of (400|401|403|404|409|422|423|429)/.test(m.text()) && issues.push(`[${step}] console.error: ${m.text().slice(0, 160)}`))
    p.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
    p.on('response', (r) => {
      if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
    })
  }
  watch(page)
  const shot = (name) => page.screenshot({ path: `test-results/sec-${name}.png`, fullPage: true })
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
  const main = () => page.locator('main')
  const toast = (re) => expect(page.getByText(re).first()).toBeVisible({ timeout: 15_000 })
  const unique = Date.now().toString().slice(-6)

  const login = async (p, who, password = who.password) => {
    await p.goto('/login')
    await p.getByLabel('Số điện thoại hoặc email').fill(who.phone)
    await p.getByRole('textbox', { name: 'Mật khẩu' }).fill(password)
    await p.getByRole('button', { name: 'Đăng nhập' }).click()
  }
  const openProperty = async (code, tab) => {
    await go(page, '/properties')
    await page.locator('a[href^="/properties/"]:not([href="/properties/new"])').filter({ hasText: new RegExp(`Khu ${code}|^${code}\\b`) }).first().click()
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', typeof tab === 'string' ? { name: tab, exact: true } : { name: tab }).click()
    await page.waitForLoadState('networkidle')
  }

  await login(page, OWNER)
  await expect(page).not.toHaveURL(/login/)

  // ------------------------------------------------------------- Cài đặt khu
  await run('Kỳ thu của khu C: đổi hạn đóng → lưu → còn nguyên sau khi tải lại', async () => {
    await openProperty('C', 'Kỳ thu')
    const due = page.getByLabel('Hạn đóng sau ngày chốt')
    await due.fill('7')
    await page.getByRole('button', { name: /^Lưu/ }).first().click()
    await toast(/Đã lưu|Đã cập nhật|đã cập nhật/i)
    await openProperty('C', 'Kỳ thu')
    await expect(page.getByLabel('Hạn đóng sau ngày chốt')).toHaveValue('7')
    await shot('1-billing-tab')
  })

  await run('Ngân hàng của khu A: đổi cần nhập lại mật khẩu → lưu → còn nguyên', async () => {
    await openProperty('A', 'Ngân hàng')
    await page.getByRole('textbox', { name: 'Ngân hàng' }).fill('Vietcombank')
    await page.getByLabel('Số tài khoản').fill(`0123${unique}`)
    await page.getByLabel('Chủ tài khoản').fill('NGUYEN VAN CHU')
    // Chưa nhập mật khẩu ⇒ không lưu được (xác nhận chính chủ đổi tài khoản nhận tiền).
    await page.getByRole('button', { name: 'Lưu tài khoản' }).click()
    await page.waitForTimeout(800)
    await expect(page.getByText(/Đã lưu|đã cập nhật/i), 'lưu được tài khoản ngân hàng mà không nhập mật khẩu').toHaveCount(0)
    await page.getByLabel('Mật khẩu đăng nhập').fill(OWNER.password)
    await shot('2b-bank-tab')
    await page.getByRole('button', { name: 'Lưu tài khoản' }).click()
    await toast(/Đã lưu|Đã cập nhật|đã cập nhật/i)
    await openProperty('A', 'Ngân hàng')
    await expect(page.getByRole('textbox', { name: 'Ngân hàng' })).toHaveValue('Vietcombank')
  })

  await run('Nội quy của khu A: lưu → còn nguyên', async () => {
    await openProperty('A', 'Nội quy')
    await page.getByLabel('Nội quy khu trọ').fill(`Giờ yên tĩnh sau 22h (test ${unique})`)
    await page.getByRole('button', { name: /^Lưu/ }).first().click()
    await toast(/Đã lưu|Đã cập nhật|đã cập nhật/i)
    await openProperty('A', 'Nội quy')
    await expect(page.getByLabel('Nội quy khu trọ')).toHaveValue(new RegExp(`test ${unique}`))
  })

  await run('Bên cho thuê của khu A hiển thị đủ', async () => {
    await openProperty('A', /^Bên cho thuê/)
    await expect(main()).toContainText(/Nguyễn Văn Chủ|Bên cho thuê|Cá nhân/)
    await shot('2-lessor-tab')
  })

  // ------------------------------------------------------------- Nhật ký thao tác
  await run('Nhật ký thao tác: lọc theo "Sửa" → mọi dòng đều là "Sửa"', async () => {
    await go(page, '/audit-logs')
    await expect(page.locator('tbody tr:visible').first(), 'nhật ký trống').toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Thao tác').selectOption({ label: 'Sửa' })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)
    const badges = await page.locator('tbody tr:visible td:nth-child(3)').allInnerTexts()
    expect(badges.length).toBeGreaterThan(0)
    expect(badges.every((t) => t.trim() === 'Sửa'), `lọc "Sửa" còn lẫn dòng khác: ${[...new Set(badges)].join(', ')}`).toBe(true)
    await shot('3-audit-filtered')
    await page.getByLabel('Thao tác').selectOption({ index: 0 })
  })

  // ------------------------------------------------------------- Quản lý đổi mật khẩu
  await run('Quản lý đổi mật khẩu: sai mật khẩu hiện tại → báo lỗi; đúng → đăng nhập được bằng mật khẩu mới', async () => {
    const context = await browser.newContext()
    const manager = await context.newPage()
    watch(manager)
    await login(manager, MANAGER_PWD)
    await expect(manager).not.toHaveURL(/login/)
    await manager.evaluate(() => {
      history.pushState({}, '', '/profile')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await manager.waitForLoadState('networkidle')
    const fillAndSubmit = async (current, next) => {
      await manager.getByLabel('Mật khẩu hiện tại').last().fill(current)
      await manager.getByLabel('Mật khẩu mới', { exact: true }).fill(next)
      await manager.getByLabel('Nhập lại mật khẩu mới').fill(next)
      await manager.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click()
    }
    await fillAndSubmit('SaiMatKhau#123456', MANAGER_PWD.next)
    await expect(manager.getByText(/không đúng|sai|không hợp lệ/i).first()).toBeVisible({ timeout: 15_000 })
    await fillAndSubmit(MANAGER_PWD.password, MANAGER_PWD.next)
    await manager.waitForTimeout(2000)
    // Đổi mật khẩu thành công ⇒ phiên cũ hết hiệu lực / về màn đăng nhập; đăng nhập lại bằng mật khẩu mới phải được.
    const relog = await browser.newContext()
    const again = await relog.newPage()
    watch(again)
    await login(again, MANAGER_PWD, MANAGER_PWD.next)
    await expect(again).not.toHaveURL(/login/, { timeout: 15_000 })
    await relog.close()
    const oldCtx = await browser.newContext()
    const oldTry = await oldCtx.newPage()
    watch(oldTry)
    await login(oldTry, MANAGER_PWD, MANAGER_PWD.password)
    await oldTry.waitForTimeout(1500)
    expect(oldTry.url(), 'mật khẩu cũ vẫn đăng nhập được sau khi đổi').toMatch(/login/)
    await oldCtx.close()
    await context.close()
  })

  // ------------------------------------------------------------- Khóa theo IP + tài khoản (ID-BR-06)
  // Sai ≥ 5 lần từ cùng IP ⇒ IP đó bị từ chối tài khoản đó, kể cả khi gõ ĐÚNG mật khẩu — và thông báo vẫn y như sai thông tin (không lộ trạng thái khóa).
  // Chủ trọ cấp lại mật khẩu thì bộ đếm được reset: đăng nhập bằng mật khẩu tạm vào được (rồi bị bắt đổi mật khẩu).
  await run('Sai mật khẩu nhiều lần → mật khẩu đúng cũng bị từ chối → chủ trọ cấp lại mật khẩu', async () => {
    const context = await browser.newContext()
    const victim = await context.newPage()
    watch(victim)
    // Mỗi lần sai phải THỰC SỰ tới server (chờ phản hồi) rồi mới thử lần sau — trình duyệt chậm có thể hủy yêu cầu khi chuyển trang quá sớm, bộ đếm sẽ thiếu.
    for (let attempt = 1; attempt <= 6; attempt++) {
      await victim.goto('/login')
      await victim.getByLabel('Số điện thoại hoặc email').fill(MANAGER_LOCK.phone)
      await victim.getByRole('textbox', { name: 'Mật khẩu' }).fill(`SaiMatKhau#${attempt}Abcdef`)
      await Promise.all([victim.waitForResponse((r) => r.url().includes('/auth/login') && r.request().method() === 'POST'), victim.getByRole('button', { name: 'Đăng nhập' }).click()])
    }
    const wrongMessage = await victim.locator('[role="alert"], [class*="alert" i]').first().innerText().catch(() => '')
    await login(victim, MANAGER_LOCK) // mật khẩu ĐÚNG
    await victim.waitForTimeout(1500)
    expect(victim.url(), 'bị khóa IP mà mật khẩu đúng vẫn đăng nhập được').toMatch(/login/)
    const lockedMessage = await victim.locator('[role="alert"], [class*="alert" i]').first().innerText().catch(() => '')
    expect(lockedMessage.trim(), 'thông báo khi bị khóa phải y như khi sai mật khẩu (không lộ trạng thái khóa)').toEqual(wrongMessage.trim())
    await context.close()
    // Chủ trọ cấp lại mật khẩu cho quản lý.
    await go(page, '/members')
    const row = page.locator('tr', { hasText: 'Trần Quản Lý' })
    await row.getByRole('button', { name: /Cấp lại mật khẩu/ }).click()
    await expect(page.getByRole('button', { name: 'Tôi đã lưu lại' })).toBeVisible({ timeout: 15_000 })
    const text = await page.locator('dialog[open]').last().innerText()
    const temp = (text.match(/Sao chép\s+Mật khẩu tạm\s+(\S+)/) ?? [])[1]
    expect(temp, 'không đọc được mật khẩu tạm').toBeTruthy()
    await page.getByRole('button', { name: 'Tôi đã lưu lại' }).click()
    const ok = await browser.newContext()
    const manager = await ok.newPage()
    watch(manager)
    await login(manager, MANAGER_LOCK, temp)
    await manager.waitForURL(/\/change-password/, { timeout: 15_000 })
    await ok.close()
  })

  await run('Nhật ký đăng nhập ghi các lần sai', async () => {
    await go(page, '/members')
    await page.getByRole('tab', { name: /Nhật ký đăng nhập/ }).click()
    await page.waitForLoadState('networkidle')
    await expect(main()).toContainText(/Sai mật khẩu/, { timeout: 10_000 })
    await shot('4-login-events')
    await page.getByLabel('Lọc theo kết quả').selectOption({ label: 'Thất bại' })
    await page.waitForLoadState('networkidle')
    await expect
      .poll(() => page.locator('tbody tr:visible').filter({ hasText: 'Đăng nhập thành công' }).count(), { timeout: 10_000, message: 'lọc "Thất bại" còn dòng thành công' })
      .toBe(0)
  })

  // ------------------------------------------------------------- Đăng xuất mọi thiết bị
  await run('Đăng xuất mọi thiết bị → về màn đăng nhập, không vào lại được trang trong', async () => {
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click()
    await page.getByRole('menuitem', { name: 'Đăng xuất mọi thiết bị' }).click()
    await page.waitForURL(/\/login/, { timeout: 15_000 })
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 15_000 })
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
