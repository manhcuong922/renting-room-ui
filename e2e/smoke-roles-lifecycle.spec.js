import { expect, test } from '@playwright/test'

// (1) Phân quyền quản lý khu: chỉ thấy khu được giao, menu quản trị bị ẩn, mở thẳng URL khu / trang quản trị của người khác bị chặn.
// (2) Vòng đời hợp đồng trên UI: chuyển phòng, báo trả phòng → thanh lý. GHI dữ liệu — chỉ chạy trên DB seed dùng một lần.
// Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-roles-lifecycle.spec.js   (API :5213 vừa seed + UI :5173)
const API = process.env.E2E_API_URL ?? 'http://localhost:5213/api/v1'
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const MANAGER_AB = { phone: '0900000008', password: 'PhoQuanLy2026' }
const MANAGER_CD = { phone: '0900000007', password: 'PhoQuanLy2026' }
const IGNORED_STATUS = new Set([401, 403, 404, 409, 422])

test.use({ actionTimeout: 15_000 })
test.setTimeout(150_000)

async function go(page, path) {
  await page.evaluate((to) => {
    history.pushState({}, '', to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
}

async function login(page, who) {
  await page.goto('/login')
  await page.getByLabel('Số điện thoại hoặc email').fill(who.phone)
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(who.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/login/)
}

/** Điền mọi ô số còn trống trong hộp thoại bằng số "Mới nhất" đang hiện cạnh ô (chỉ số cuối / chỉ số nhận phòng). */
async function fillLatestReadings(dialog) {
  const inputs = dialog.locator('input[inputmode="decimal"], input[type="text"]:not([maxlength])')
  for (let i = 0; i < (await inputs.count()); i++) {
    const input = inputs.nth(i)
    if ((await input.inputValue()) !== '') continue
    const text = await input.locator('xpath=ancestor::*[contains(., "Mới nhất")][1]').innerText().catch(() => '')
    const m = text.match(/Mới nhất:\s*([\d.]+(?:,\d+)?)/)
    if (m) await input.fill(m[1].replace(/\./g, ''))
  }
}

const collect = (page, issues, stepRef) => {
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && issues.push(`[${stepRef.v}] console.error: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => issues.push(`[${stepRef.v}] pageerror: ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_STATUS.has(r.status()) && r.url().includes('/api/')) issues.push(`[${stepRef.v}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')}`)
  })
}

const makeRun = (page, issues, stepRef) => async (name, fn) => {
  stepRef.v = name
  try {
    await fn()
  } catch (e) {
    issues.push(`[${name}] ${String(e.message).split('\n').slice(0, 5).join(' | ').slice(0, 500)}`)
    await page.screenshot({ path: `test-results/rl-fail-${name.replace(/\W+/g, '_').slice(0, 40)}.png` }).catch(() => {})
    await page.keyboard.press('Escape').catch(() => {})
  }
}

/** Mã khu hiển thị trên trang Khu trọ (chữ cái đầu của mỗi thẻ / hàng). */
const visibleProperties = async (page) => {
  await go(page, '/properties')
  const hrefs = await page.locator('a[href^="/properties/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')).filter((h) => /^\/properties\/[^/]+$/.test(h) && h !== '/properties/new'))
  return [...new Set(hrefs)]
}

test('phân quyền: quản lý khu chỉ thấy khu được giao', async ({ browser, request }, testInfo) => {
  const issues = []
  const stepRef = { v: '' }
  const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:5173'

  // Lấy id các khu từ API (chủ trọ) để biết "khu của người kia".
  const token = (await (await request.post(`${API}/auth/login`, { data: { username: OWNER.phone, password: OWNER.password } })).json()).accessToken
  const all = (await (await request.get(`${API}/properties`, { headers: { Authorization: `Bearer ${token}` } })).json()).items
  const byCode = Object.fromEntries(all.map((p) => [p.code, p.id]))
  expect(Object.keys(byCode).sort()).toEqual(['A', 'B', 'C', 'D'])

  for (const [who, mine, others] of [
    [MANAGER_AB, ['A', 'B'], ['C', 'D']],
    [MANAGER_CD, ['C', 'D'], ['A', 'B']],
  ]) {
    // Phiên SPA giữ trong bộ nhớ ⇒ mỗi người một context mới, không dính phiên người trước.
    const context = await browser.newContext({ baseURL, viewport: { width: 1360, height: 860 } })
    const page = await context.newPage()
    collect(page, issues, stepRef)
    const run = makeRun(page, issues, stepRef)
    await run(`Đăng nhập ${who.phone}`, async () => {
      await login(page, who)
    })
    await run(`${who.phone}: danh sách khu`, async () => {
      const hrefs = await visibleProperties(page)
      const ids = mine.map((c) => byCode[c])
      for (const id of ids) expect(hrefs.some((h) => h.endsWith(id)), `thiếu khu của mình ${id}`).toBe(true)
      for (const c of others) expect(hrefs.some((h) => h.endsWith(byCode[c])), `thấy khu ${c} của người khác`).toBe(false)
    })
    await run(`${who.phone}: menu quản trị bị ẩn`, async () => {
      const nav = page.locator('nav')
      for (const label of ['Nhật ký thao tác']) await expect(nav.getByText(label, { exact: true })).toHaveCount(0)
    })
    await run(`${who.phone}: mở thẳng khu / trang của người khác`, async () => {
      for (const c of others) {
        await go(page, `/properties/${byCode[c]}`)
        const body = await page.locator('body').innerText()
        expect(body, `thấy dữ liệu khu ${c}`).not.toMatch(new RegExp(`Khu ${c} —`))
      }
      for (const path of ['/audit-logs']) {
        await go(page, path)
        expect(await page.locator('main').innerText(), `${path} không bị chặn`).toMatch(/không có quyền|Không có quyền|không được phép|Không tìm thấy|403/i)
      }
    })
    await run(`${who.phone}: phiếu & hợp đồng chỉ của khu mình`, async () => {
      await go(page, '/contracts')
      const rooms = await page.locator('table tbody tr td:nth-child(2)').allTextContents()
      const codes = new Set(rooms.map((t) => t.trim()[0]))
      for (const c of others) expect(codes.has(c), `hợp đồng khu ${c} lộ ra`).toBe(false)
    })
  }

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})

test('vòng đời hợp đồng: chuyển phòng, thanh lý', async ({ page }, testInfo) => {
  const issues = []
  const stepRef = { v: '' }
  collect(page, issues, stepRef)
  const run = makeRun(page, issues, stepRef)
  await login(page, OWNER)

  const openContract = async (no) => {
    await go(page, '/contracts')
    await page.getByLabel('Tìm số hợp đồng').fill(no)
    await page.waitForTimeout(900)
    await page.locator(`a[href^="/contracts/"]:has-text("${no}")`).first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: new RegExp(no) }).first()).toBeVisible()
  }

  await run('Chuyển phòng HD2026-0003', async () => {
    await openContract('HD2026-0003')
    // Chạy lại trên DB đã chuyển rồi thì HĐ nằm phòng khác và không còn nút — không phải lỗi.
    if (!(await page.getByRole('button', { name: 'Chuyển phòng' }).count())) return
    await page.getByRole('button', { name: 'Chuyển phòng' }).first().click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog.getByText(/Chuyển phòng — hợp đồng/)).toBeVisible()
    await page.screenshot({ path: 'test-results/rl-transfer-dialog.png' })
    const room = dialog.getByLabel('Chuyển sang phòng')
    await expect(room).toBeVisible()
    const options = await room.locator('option:not([value=""])').all()
    expect(options.length, 'không có phòng trống để chuyển').toBeGreaterThan(0)
    await room.selectOption({ index: 1 })
    await fillLatestReadings(dialog)
    await dialog.getByRole('button', { name: /^Chuyển phòng$/ }).last().click()
    await expect(page.getByText(/Đã chuyển/).first()).toBeVisible({ timeout: 15_000 })
  })

  await run('Thanh lý HD2026-0017: bị chặn bởi phiếu nháp → xóa nháp → thanh lý', async () => {
    await openContract('HD2026-0017')
    const start = async () => {
      await page.getByRole('button', { name: 'Thanh lý' }).first().click()
      const dialog = page.locator('dialog[open]')
      await expect(dialog.getByText('Thanh lý — trả phòng')).toBeVisible()
      await page.waitForLoadState('networkidle')
      await fillLatestReadings(dialog)
      await page.waitForTimeout(600) // chờ bản xem trước về để biết có hóa đơn chặn không
      const startButton = dialog.getByRole('button', { name: 'Bắt đầu thanh lý' })
      if (!(await startButton.isDisabled())) await startButton.click() // bị chặn ⇒ nút đã khóa, hộp thoại tự giải thích
      return dialog
    }
    let dialog = await start()
    const done = page.getByText('Đã chuyển sang thanh lý.')
    // Quy tắc: nháp tháng đã lập cho kỳ chứa ngày trả phòng phải xóa trước — hộp thoại phải nói rõ và dẫn tới hóa đơn.
    await Promise.race([done.waitFor({ timeout: 8_000 }), dialog.getByText(/Phải xóa trước/).waitFor({ timeout: 8_000 })]).catch(() => {})
    if (!(await done.count())) {
      await expect(dialog.getByText(/Phải xóa trước/)).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Bắt đầu thanh lý' }), 'bị chặn mà nút vẫn bấm được').toBeDisabled()
      await page.screenshot({ path: 'test-results/rl-liquidate-blocked.png' })
      const link = dialog.locator('a[href^="/invoices/"]').first()
      await expect(link, 'hộp thoại chặn nhưng không có liên kết tới hóa đơn cần xóa').toBeVisible()
      await link.click()
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Xóa nháp' }).first().click()
      await page.locator('dialog[open]').getByRole('button', { name: /Xóa/ }).last().click()
      await expect(page.getByText(/Đã xóa/).first()).toBeVisible({ timeout: 15_000 })
      await openContract('HD2026-0017')
      dialog = await start()
      await expect(done).toBeVisible({ timeout: 15_000 })
    }
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/rl-liquidating.png', fullPage: true })
    expect(await page.locator('main').innerText()).toMatch(/Đang thanh lý/)
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
