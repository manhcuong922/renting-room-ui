import { useEffect } from 'react'

// Khóa cuộn trang nền khi drawer/modal đang mở (mobile).
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined
    document.body.classList.add('scroll-locked')
    return () => document.body.classList.remove('scroll-locked')
  }, [locked])
}
