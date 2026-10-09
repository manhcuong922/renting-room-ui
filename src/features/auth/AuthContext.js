import { createContext, useContext } from 'react'
import { canViewSensitiveData, hasPermission } from './permissions'

export const AuthContext = createContext(null)

/**
 * @returns {{
 *   status: 'loading' | 'authenticated' | 'anonymous' | 'error',
 *   user: null | { id: string, fullName: string, role: string, mustChangePassword: boolean, canViewSensitiveData: boolean, organization: null | { id: string, code: string, name: string } },
 *   endReason: null | import('@/lib/http/ApiError').ApiError,
 *   login: (credentials: { username: string, password: string }) => Promise<object>,
 *   changePassword: (body: { currentPassword: string, newPassword: string }) => Promise<object>,
 *   logout: () => Promise<void>,
 *   logoutAll: () => Promise<void>,
 *   retry: () => void,
 * }}
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  return context
}

export function usePermission(permission) {
  return hasPermission(useAuth().user, permission)
}

export function useCanViewSensitiveData() {
  return canViewSensitiveData(useAuth().user)
}
