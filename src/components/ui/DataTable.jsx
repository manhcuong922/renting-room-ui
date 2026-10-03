import { useNavigate } from 'react-router'
import { cx } from '@/lib/cx'
import styles from './DataTable.module.css'

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="menuitem"]'

/**
 * Bảng dữ liệu responsive: bảng trên desktop (≥768px), danh sách thẻ trên mobile.
 * columns: [{ key, header, cell(row), align?: 'right', primary?: true (tiêu đề thẻ mobile),
 *             hideOnMobile?: true, width? }]
 * rowHref(row) → cả dòng bấm được (ô `primary` nên chứa <Link> thật để dùng bàn phím).
 */
export function DataTable({ columns, rows, rowKey = (r) => r.id, rowHref, rowClassName, caption, stale = false }) {
  const navigate = useNavigate()
  const primary = columns.find((c) => c.primary) ?? columns[0]
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile)

  const onRowClick = (event, row) => {
    if (!rowHref || event.target.closest(INTERACTIVE)) return
    navigate(rowHref(row))
  }

  return (
    <div className={cx(styles.wrap, stale && styles.stale)}>
      {/* Desktop */}
      <table className={styles.table}>
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={{ width: c.width, textAlign: c.align }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cx(rowHref && styles.clickable, rowClassName?.(row))}
              onClick={(e) => onRowClick(e, row)}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align }}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile */}
      <ul className={styles.cards}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cx(styles.card, rowHref && styles.clickable, rowClassName?.(row))}
            onClick={(e) => onRowClick(e, row)}
          >
            <div className={styles.cardTitle}>{primary.cell(row)}</div>
            <dl className={styles.cardList}>
              {rest.map((c) => (
                <div key={c.key} className={styles.cardRow}>
                  <dt>{c.header}</dt>
                  <dd>{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  )
}
