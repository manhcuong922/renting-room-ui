import { cloneElement, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './Tooltip.module.css'

/**
 * Tooltip hiển thị qua portal (không bị overflow của sidebar cắt mất).
 * Bọc đúng 1 phần tử con có thể focus. `disabled` → render con nguyên trạng.
 */
export function Tooltip({ content, placement = 'right', disabled = false, children }) {
  const id = useId()
  const [position, setPosition] = useState(null)

  if (disabled || !content) return children

  const show = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setPosition(
      placement === 'right'
        ? { top: rect.top + rect.height / 2, left: rect.right + 10 }
        : { top: rect.bottom + 8, left: rect.left + rect.width / 2 },
    )
  }
  const hide = () => setPosition(null)

  const trigger = cloneElement(children, {
    'aria-describedby': position ? id : undefined,
    onMouseEnter: (e) => {
      children.props.onMouseEnter?.(e)
      show(e)
    },
    onMouseLeave: (e) => {
      children.props.onMouseLeave?.(e)
      hide()
    },
    onFocus: (e) => {
      children.props.onFocus?.(e)
      if (e.currentTarget.matches(':focus-visible')) show(e)
    },
    onBlur: (e) => {
      children.props.onBlur?.(e)
      hide()
    },
  })

  return (
    <>
      {trigger}
      {position &&
        createPortal(
          <span id={id} role="tooltip" className={styles.tooltip} data-placement={placement} style={position}>
            {content}
          </span>,
          document.body,
        )}
    </>
  )
}
