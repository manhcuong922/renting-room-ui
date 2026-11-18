import { useTheme } from '@/lib/theme'
import { cx } from '@/lib/cx'
import styles from './ThemeToggle.module.css'
import { THEME_OPTIONS } from './themeOptions'

/** Nhóm 3 nút chọn chế độ giao diện (dùng ở màn đăng nhập; trong app dùng mục "Giao diện" của menu tài khoản). */
export function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme()
  return (
    <div className={cx(styles.group, className)} role="group" aria-label="Giao diện">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" className={cx(styles.option, theme === value && styles.active)} aria-pressed={theme === value} title={label} onClick={() => setTheme(value)}>
          <Icon size={16} aria-hidden />
          <span className="visually-hidden">{label}</span>
        </button>
      ))}
    </div>
  )
}
