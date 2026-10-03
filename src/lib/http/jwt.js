// Giải mã payload JWT phía client — CHỈ để phục vụ giao diện (hạn token, phát hiện đổi người dùng).
// Không xác thực chữ ký: quyền thật luôn do server kiểm tra.
// Claim theo renting_room.Application/Common/Security/AppClaimTypes.cs:
//   sub (user id) · role · org (organization id) · stamp · pwd_change ("true") · jti · exp (giây)
export function decodeJwt(token) {
  if (typeof token !== 'string') return null
  const [, payload] = token.split('.')
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

/** @returns {{ userId: string|null, role: string|null, organizationId: string|null, mustChangePassword: boolean, expiresAt: number }} */
export function readAccessClaims(token) {
  const claims = decodeJwt(token)
  if (!claims) return null
  return {
    userId: claims.sub ?? null,
    role: claims.role ?? null,
    organizationId: claims.org ?? null,
    mustChangePassword: claims.pwd_change === 'true',
    expiresAt: typeof claims.exp === 'number' ? claims.exp * 1000 : 0,
  }
}
