import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

/** toast.success / error / warning / info(message, { title, duration }) */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast phải dùng bên trong <ToastProvider>')
  return ctx
}
