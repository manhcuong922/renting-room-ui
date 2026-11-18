import { expect, test } from '@playwright/test'

// Các hộp thoại chính ở màn hình điện thoại (390×800): không tràn ngang, nút ở chân hộp thoại luôn nằm trong màn hình, ô nhập không vượt khung.
// KHÔNG ghi dữ liệu (chỉ mở rồi đóng) — chạy được trên DB dev. Cần API :5213 có dữ liệu demo + UI :5173.
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.use({ viewport: { width: 390, height: 800 }, actionTimeout: 15_000 })
test.setTimeout(150_000)

async function go(page, path) {
  await page.evaluate((to) => {
    history.pushState({}, '', to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

/** Vấn đề bố cục của hộp thoại đang mở (sau khi hiệu ứng mở xong). */
const dialogProblems = (page) =>
  page.evaluate(() => {
    const dlg = document.querySelector('dialog[open]')
    if (!dlg) return ['không có hộp thoại đang mở']
    const out = []
    const d = dlg.getBoundingClientRect()
    if (d.left < -1 || d.right > innerWidth + 1) out.push(`hộp thoại tràn ngang (${Math.round(d.left)}→${Math.round(d.right)} / ${innerWidth})`)
    if (dlg.scrollWidth > dlg.clientWidth + 1) out.push(`nội dung hộp thoại cuộn ngang (${dlg.scrollWidth} > ${dlg.clientWidth})`)
    for (const el of dlg.querySelectorAll('button, input, select, textarea')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      if (el.closest('table, [class*="scroll"], [class*="table"]')) continue
      if (r.right > innerWidth + 1 || r.left < -1) out.push(`ngoài màn hình: <${el.tagName.toLowerCase()}> "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}"`)
    }
    // Nút chân hộp thoại (Hủy / xác nhận) phải thấy được mà không cần cuộn trang.
    const footerButtons = [...dlg.querySelectorAll('footer button, [class*="footer"] button')]
    for (const b of footerButtons) {
      const r = b.getBoundingClientRect()
      if (r.bottom > innerHeight + 1) out.push(`nút chân hộp thoại bị đẩy khỏi màn hình: "${(b.textContent || '').trim().slice(0, 30)}"`)
    }
    return out
  })

test('hộp thoại chính ở điện thoại không vỡ bố cục', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${step}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
  const run = async (name, fn) => {
    step = name
    try {
      await fn()
      await page.waitForTimeout(600) // chờ hiệu ứng mở xong rồi mới đo
      for (const p of await dialogProblems(page)) issues.push(`[${name}] ${p}`)
      await page.screenshot({ path: `test-results/mobile-${name.replace(/\W+/g, '_').slice(0, 40)}.png` })
    } catch (e) {
      issues.push(`[${name}] ${String(e.message).split('\n').slice(0, 4).join(' | ').slice(0, 400)}`)
    }
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(200)
  }

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
  }

  await run('Tạo phiếu', async () => {
    await go(page, '/invoices')
    await page.getByRole('button', { name: 'Tạo phiếu' }).first().click()
    await expect(page.locator('dialog[open]')).toBeVisible()
  })

  // HĐ 0004: đang hiệu lực, có người ở — mở các hộp thoại vòng đời.
  for (const [name, button] of [
    ['Thanh lý', 'Thanh lý'],
    ['Chuyển phòng', 'Chuyển phòng'],
    ['Sửa giá thuê', 'Sửa giá thuê'],
    ['Thu tiền', 'Thu tiền'],
  ]) {
    await run(`HĐ-${name}`, async () => {
      await openContract('HD2026-0004')
      await page.getByRole('button', { name: button }).first().click()
      await expect(page.locator('dialog[open]')).toBeVisible()
    })
  }

  await run('Phòng-thêm', async () => {
    await go(page, '/rooms')
    const add = page.getByRole('button', { name: /Thêm phòng|Tạo phòng/ }).first()
    await add.waitFor({ timeout: 10_000 }).catch(() => {}) // trình duyệt chậm vẽ nút hơn networkidle
    if (!(await add.count())) throw new Error('không thấy nút thêm phòng ở trang Phòng')
    await add.click()
    await expect(page.locator('dialog[open]')).toBeVisible()
  })

  await run('Người thuê-thêm', async () => {
    await go(page, '/renters')
    await page.getByRole('button', { name: /Thêm/ }).first().click()
    await expect(page.locator('dialog[open]')).toBeVisible()
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
