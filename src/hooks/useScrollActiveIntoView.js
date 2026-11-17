import { useEffect } from 'react'

/**
 * Cuộn NGANG hộp chứa để phần tử đang chọn (`selector`) nằm giữa khung nhìn — thanh tab / thanh bước trên điện thoại cuộn ngang
 * và ẩn thanh cuộn, nên tab hoặc bước hiện tại có thể nằm ngoài màn hình (vd. mở thẳng ?tab=import, hoặc sang bước 4/7).
 * Chỉ đổi scrollLeft của hộp, không kéo cả trang theo chiều dọc.
 */
export function useScrollActiveIntoView(containerRef, selector, dependency) {
  useEffect(() => {
    const container = containerRef.current
    const active = container?.querySelector(selector)
    if (!container || !active || container.scrollWidth <= container.clientWidth) return
    const left = active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2
    container.scrollTo({ left: Math.max(0, left), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [containerRef, selector, dependency])
}
