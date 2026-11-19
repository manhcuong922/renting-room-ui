/**
 * Lưới nhập liệu (chỉ số điện nước, lắp / thay công tơ hàng loạt): Enter — hoặc nút "Tiếp" của bàn phím điện thoại — nhảy sang ô
 * cùng nhóm kế tiếp đang hiện, thay vì phải chạm từng ô rồi cuộn tay. Bảng (desktop) và thẻ (mobile) cùng có trong DOM nên chỉ lấy ô đang hiện.
 *
 *   <NumberField data-grid="readings" enterKeyHint="next" onKeyDown={focusNextOnEnter} … />
 */
export function focusNextOnEnter(event) {
  if (event.key !== 'Enter' || event.nativeEvent?.isComposing) return
  const group = event.currentTarget.dataset.grid
  if (!group) return
  event.preventDefault()
  const inputs = [...document.querySelectorAll(`input[data-grid="${group}"]`)].filter((el) => !el.disabled && el.getClientRects().length > 0)
  const next = inputs[inputs.indexOf(event.currentTarget) + 1]
  if (next) {
    next.focus()
    next.select?.()
    next.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  } else {
    event.currentTarget.blur() // ô cuối: đóng bàn phím để thấy nút Lưu
  }
}
