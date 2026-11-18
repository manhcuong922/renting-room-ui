import { useSyncExternalStore } from 'react'

// Chế độ giao diện: 'light' | 'dark' | 'system' (theo hệ điều hành). Lưu ở localStorage (khóa 'rr-theme'; system = không lưu).
// Áp bằng thuộc tính data-theme trên <html> (xem styles/tokens.css); public/theme-init.js áp sớm trước khi vẽ để không nháy.
export const THEMES = ['light', 'dark', 'system']
const STORAGE_KEY = 'rr-theme'
const THEME_COLORS = { light: '#0f766e', dark: '#121920' }

const listeners = new Set()
let current = readStored()

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

const systemPrefersDark = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches

/** Chế độ đang hiển thị thật sự (system → theo hệ điều hành). */
export const resolveTheme = (theme = current) => (theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme)

function apply(theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  // Màu thanh trình duyệt trên điện thoại.
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
  }
  meta.removeAttribute('media')
  meta.content = THEME_COLORS[resolveTheme(theme)]
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return
  current = theme
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* không lưu được thì chỉ áp cho phiên này */
  }
  apply(theme)
  listeners.forEach((listener) => listener())
}

/** Gọi một lần khi khởi động: áp chế độ đã lưu và theo dõi đổi giao diện của hệ điều hành khi đang ở "Theo hệ thống". */
export function initTheme() {
  apply(current)
  if (typeof window.matchMedia !== 'function') return
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (current === 'system') {
      apply('system')
      listeners.forEach((listener) => listener())
    }
  })
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => 'system')
  return { theme, resolved: resolveTheme(theme), setTheme }
}
