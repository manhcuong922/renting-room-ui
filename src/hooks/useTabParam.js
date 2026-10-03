import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/** Tab hiện tại lưu trên URL (?tab=) — F5 / chia sẻ link vẫn mở đúng tab. */
export function useTabParam(defaultTab, param = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams()
  const value = searchParams.get(param) ?? defaultTab
  const setValue = useCallback(
    (next) =>
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next === defaultTab) params.delete(param)
          else params.set(param, next)
          return params
        },
        { replace: true },
      ),
    [setSearchParams, defaultTab, param],
  )
  return [value, setValue]
}
