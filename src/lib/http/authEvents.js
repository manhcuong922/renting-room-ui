// Kênh sự kiện giữa tầng HTTP (không phải React) và AuthProvider.
//   'session-expired'           → phiên hết hiệu lực, về màn đăng nhập
//   'password-change-required'  → 403 PASSWORD_CHANGE_REQUIRED, chuyển màn đổi mật khẩu
//   'forbidden'                 → 403 FORBIDDEN, quyền có thể đã đổi → kiểm tra lại /me
//   'tokens-refreshed'          → vừa xoay token; payload = claim JWT mới (sub, role, pwd_change…)
const target = new EventTarget()

export const authEvents = {
  on(type, listener) {
    const handler = (event) => listener(event.detail)
    target.addEventListener(type, handler)
    return () => target.removeEventListener(type, handler)
  },
  emit(type, detail) {
    target.dispatchEvent(new CustomEvent(type, { detail }))
  },
}
