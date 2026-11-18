import { expect, test } from '@playwright/test'

// Dark mode: công tắc ở màn đăng nhập + menu tài khoản, nhớ lựa chọn sau khi tải lại, "Theo hệ thống" theo hệ điều hành,
// rồi quét mọi trang ở chế độ tối tìm nền trắng cứng / chữ thiếu tương phản (so với chế độ sáng để loại nhiễu có sẵn).
// KHÔNG ghi dữ liệu. Chạy: E2E_HEADLESS=1 npx playwright test e2e/smoke-dark-mode.spec.js   (API :5213 có dữ liệu demo + UI :5173)
const OWNER = { phone: '0900000009', password: 'ChuTroDemo2026' }
const PAGES = [
  '/dashboard', '/properties', '/rooms', '/renters', '/contracts', '/contracts/new', '/contract-templates', '/meter-readings',
  '/invoices', '/room-charges', '/audit-logs', '/tenancy-history', '/members', '/organization', '/profile',
]

test.use({ actionTimeout: 15_000 })
test.setTimeout(240_000)

async function go(page, to) {
  await page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, to)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
}

const themeOf = (page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'))
const bodyBackground = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const luminance = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Phần tử hiển thị chữ có độ tương phản < 3:1 với nền thực tế, và vùng lớn còn nền trắng cứng. */
const scan = (page) =>
  page.evaluate(() => {
    const parse = (value) => {
      const m = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]
      return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }
    }
    const lum = ({ r, g, b }) => {
      const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const blend = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 })
    const effectiveBackground = (el) => {
      const layers = []
      for (let node = el; node; node = node.parentElement) {
        const c = parse(getComputedStyle(node).backgroundColor)
        if (c.a > 0) layers.push(c)
        if (c.a === 1) break
      }
      return layers.reduceRight((below, layer) => blend(layer, below), { r: 255, g: 255, b: 255, a: 1 })
    }
    const low = new Map()
    const white = new Set()
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height || getComputedStyle(el).visibility === 'hidden') continue
      const label = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0].replace(/_[a-z0-9]{5,}_\d+$/i, '') : ''}`
      if (rect.width * rect.height > 1500 && getComputedStyle(el).backgroundColor === 'rgb(255, 255, 255)') white.add(label)
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (!hasText) continue
      const fg = parse(getComputedStyle(el).color)
      const bg = effectiveBackground(el)
      const front = blend(fg, bg)
      const [hi, lo] = [lum(front), lum(bg)].sort((a, b) => b - a)
      const ratio = (hi + 0.05) / (lo + 0.05)
      if (ratio < 3) low.set(`${label} "${el.textContent.trim().slice(0, 28)}" ${ratio.toFixed(1)}:1`, ratio)
    }
    return { low: [...low.keys()].slice(0, 25), white: [...white].slice(0, 15) }
  })

test('dark mode: công tắc, ghi nhớ, theo hệ thống, quét toàn bộ trang', async ({ page }, testInfo) => {
  const issues = []
  let step = ''
  page.on('pageerror', (e) => issues.push(`[${step}] pageerror: ${e.message.slice(0, 160)}`))
  const run = async (name, fn) => {
    step = name
    try {
      await fn()
    } catch (e) {
      issues.push(`[${name}] ${String(e.message).split('\n').slice(0, 4).join(' | ').slice(0, 450)}`)
    }
  }

  await run('Màn đăng nhập: công tắc', async () => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/login')
    expect(await themeOf(page)).toBeNull() // chưa chọn ⇒ theo hệ thống (đang sáng)
    const light = luminance(await bodyBackground(page))
    await page.getByRole('button', { name: 'Tối' }).click()
    expect(await themeOf(page)).toBe('dark')
    expect(luminance(await bodyBackground(page)), 'nền không tối sau khi chọn Tối').toBeLessThan(light - 0.3)
    await page.screenshot({ path: 'test-results/dark-login.png' })
  })

  await run('Ghi nhớ sau khi tải lại', async () => {
    await page.reload()
    expect(await themeOf(page), 'tải lại mất lựa chọn').toBe('dark')
    expect(await page.getByRole('button', { name: 'Tối' }).getAttribute('aria-pressed')).toBe('true')
  })

  await run('Theo hệ thống', async () => {
    await page.getByRole('button', { name: 'Theo hệ thống' }).click()
    expect(await themeOf(page)).toBeNull()
    await page.emulateMedia({ colorScheme: 'dark' })
    expect(luminance(await bodyBackground(page)), 'Theo hệ thống không theo OS tối').toBeLessThan(0.3)
    await page.emulateMedia({ colorScheme: 'light' })
    expect(luminance(await bodyBackground(page)), 'Theo hệ thống không quay về sáng').toBeGreaterThan(0.7)
    await page.getByRole('button', { name: 'Sáng' }).click()
    await page.emulateMedia({ colorScheme: 'dark' }) // ép Sáng thắng OS tối
    expect(await themeOf(page)).toBe('light')
    expect(luminance(await bodyBackground(page)), 'ép Sáng nhưng OS tối vẫn làm nền tối').toBeGreaterThan(0.7)
    await page.emulateMedia({ colorScheme: 'light' })
  })

  await run('Đăng nhập + menu tài khoản', async () => {
    await page.getByLabel('Số điện thoại hoặc email').fill(OWNER.phone)
    await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(OWNER.password)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page).not.toHaveURL(/login/)
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click()
    const dark = page.getByRole('menuitemradio', { name: 'Tối' })
    await expect(dark).toBeVisible()
    await dark.click()
    expect(await themeOf(page)).toBe('dark')
    await expect(page.getByRole('menuitemradio', { name: 'Tối' })).toHaveAttribute('aria-checked', 'true')
    await page.screenshot({ path: 'test-results/dark-user-menu.png' })
    await page.keyboard.press('Escape')
  })

  // ---- Quét: sáng làm chuẩn, tối chỉ báo lỗi MỚI
  const lightIssues = {}
  await run('Quét chế độ sáng (chuẩn)', async () => {
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click()
    await page.getByRole('menuitemradio', { name: 'Sáng' }).click()
    await page.keyboard.press('Escape') // menu giữ mở sau khi chọn để đổi qua lại; đóng trước khi quét
    for (const path of PAGES) {
      await go(page, path)
      lightIssues[path] = await scan(page)
    }
  })

  await run('Quét chế độ tối', async () => {
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click()
    await page.getByRole('menuitemradio', { name: 'Tối' }).click()
    await page.keyboard.press('Escape')
    for (const path of PAGES) {
      await go(page, path)
      const dark = await scan(page)
      const baseLow = new Set((lightIssues[path]?.low ?? []).map((l) => l.replace(/ [\d.]+:1$/, '')))
      const baseWhite = new Set(lightIssues[path]?.white ?? [])
      const newLow = dark.low.filter((l) => !baseLow.has(l.replace(/ [\d.]+:1$/, '')))
      const newWhite = dark.white
      if (newLow.length) issues.push(`[tối ${path}] chữ thiếu tương phản: ${newLow.slice(0, 6).join(' ; ')}`)
      if (newWhite.length) issues.push(`[tối ${path}] nền trắng cứng: ${newWhite.slice(0, 6).join(', ')}`)
      void baseWhite
      await page.screenshot({ path: `test-results/dark${path.replace(/\W+/g, '_')}.png`, fullPage: false })
    }
  })

  await testInfo.attach('issues.txt', { body: issues.join('\n') || '(không có)', contentType: 'text/plain' })
  expect(issues, issues.join('\n')).toEqual([])
})
