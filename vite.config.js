import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// Content-Security-Policy cho bản build (chống XSS: chỉ chạy script của chính app, chỉ gọi API đã khai báo).
// frame-ancestors / X-Frame-Options không đặt được bằng <meta> → đặt ở web server (deploy/nginx.conf.example).
function cspPlugin(apiBaseUrl) {
  const apiOrigin = /^https?:\/\//i.test(apiBaseUrl) ? new URL(apiBaseUrl).origin : null
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    ['connect-src', "'self'", apiOrigin].filter(Boolean).join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  return {
    name: 'renting-room-csp',
    apply: 'build', // dev server cần inline script cho HMR → chỉ áp khi build
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_BASE_URL || '/api/v1'

  // Dev & preview gọi /api qua proxy → cùng origin với trang, KHÔNG phát sinh CORS/preflight.
  const proxy = {
    '/api': {
      target: env.VITE_API_PROXY_TARGET || 'http://localhost:5213',
      changeOrigin: true,
    },
  }

  return {
    plugins: [react(), cspPlugin(apiBaseUrl)],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  }
})
