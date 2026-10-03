import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDebouncedValue } from './useDebouncedValue'

/**
 * Bộ lọc danh sách lưu trên URL (F5 / chia sẻ link giữ nguyên). Đổi bộ lọc → về trang 1.
 * `defaults` phải là hằng số khai báo NGOÀI component (tham chiếu ổn định).
 *
 *   const list = useListParams({ search: '', status: '', page: 1 })
 *   list.params      // giá trị đã chuẩn hóa (page là số)
 *   list.set({ status: 'Active' })
 *   <TextField {...list.searchInput} />   // ô tìm kiếm có debounce 300ms
 */
export function useListParams(defaults, { searchKey = 'search' } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const params = useMemo(() => {
    const out = {}
    for (const [key, def] of Object.entries(defaults)) {
      const raw = searchParams.get(key)
      if (raw === null) out[key] = def
      else if (typeof def === 'number') out[key] = Math.max(1, Number(raw) || def)
      else if (typeof def === 'boolean') out[key] = raw === '1'
      else out[key] = raw
    }
    return out
  }, [searchParams, defaults])

  const set = useCallback(
    (changes) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const resetsPage = Object.keys(changes).some((k) => k !== 'page')
          for (const [key, value] of Object.entries(changes)) {
            const isDefault = value === defaults[key] || value === '' || value === null || value === false
            if (isDefault) next.delete(key)
            else next.set(key, value === true ? '1' : String(value))
          }
          if (resetsPage && !('page' in changes)) next.delete('page')
          return next
        },
        { replace: true },
      ),
    [setSearchParams, defaults],
  )

  // Ô tìm kiếm: gõ tự do, ghi lên URL sau 300ms.
  const current = params[searchKey] ?? ''
  const [input, setInput] = useState(current)
  const debounced = useDebouncedValue(input.trim(), 300)
  useEffect(() => {
    if (debounced !== current) set({ [searchKey]: debounced })
  }, [debounced, current, searchKey, set])

  return {
    params,
    set,
    searchInput: { value: input, onChange: (e) => setInput(e.target.value) },
  }
}
