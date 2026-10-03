import { useEffect, useState } from 'react'

// useState có lưu localStorage — chỉ dùng cho tiện ích giao diện (sidebar thu gọn, bộ lọc nhớ lại…).
export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw == null ? initialValue : JSON.parse(raw)
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage bị chặn — giữ state trong bộ nhớ.
    }
  }, [key, value])

  return [value, setValue]
}
