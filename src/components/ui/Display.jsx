import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getErrorMessage } from '@/lib/http/ApiError'
import { cx } from '@/lib/cx'
import { formatDateTime } from '@/lib/format'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card } from './Card'
import { Alert } from './Feedback'
import { Modal } from './Modal'
import styles from './Display.module.css'

/** Khối nội dung có tiêu đề + nút hành động. */
export function Section({ title, description, actions, children, padded = true, className }) {
  return (
    <Card padded={padded} className={cx(styles.section, className)}>
      {(title || actions) && (
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeadings}>
            {title && <h2 className={styles.sectionTitle}>{title}</h2>}
            {description && <p className={styles.sectionDescription}>{description}</p>}
          </div>
          {actions && <div className={styles.sectionActions}>{actions}</div>}
        </div>
      )}
      {children}
    </Card>
  )
}

/** Danh sách nhãn: giá trị. items: [{ label, value, full? }] — value rỗng hiện "—". */
export function DescriptionList({ items, columns = 2 }) {
  return (
    <dl className={cx(styles.dl, columns === 1 && styles.dlSingle)}>
      {items
        .filter((i) => !i.hidden)
        .map((item) => (
          <div key={item.label} className={cx(styles.dlItem, item.full && styles.dlFull)}>
            <dt>{item.label}</dt>
            <dd>{item.value === null || item.value === undefined || item.value === '' ? '—' : item.value}</dd>
          </div>
        ))}
    </dl>
  )
}

export function StatusBadge({ map, value }) {
  const meta = map[value]
  return <Badge tone={meta?.tone ?? 'neutral'}>{meta?.label ?? value}</Badge>
}

/** Thanh công cụ trên danh sách: ô tìm kiếm + bộ lọc, tự xuống dòng. */
export function Toolbar({ children }) {
  return <div className={styles.toolbar}>{children}</div>
}

export function CopyButton({ value, label = 'Sao chép' }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>
      {copied ? 'Đã chép' : label}
    </Button>
  )
}

/**
 * Số giấy tờ đã che + nút 👁 xem đầy đủ. Mỗi lần xem server ghi log → không tự gọi, không cache,
 * tự ẩn lại sau 30 giây (docs/api/renters.md#xem-số-giấy-tờ).
 * Không truyền `onReveal` (không có quyền dữ liệu nhạy cảm) → chỉ hiện số đã che, không có nút.
 * 429 (5 lần/phút mỗi tài khoản) → khóa nút theo Retry-After.
 */
export function SecretValue({ masked, onReveal }) {
  const [value, setValue] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!value) return undefined
    const timer = setTimeout(() => setValue(null), 30_000)
    return () => clearTimeout(timer)
  }, [value])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (!masked) return '—'
  if (!onReveal) return <span className={styles.secretValue}>{masked}</span>

  const toggle = async () => {
    if (value) return setValue(null)
    setBusy(true)
    setError(null)
    try {
      const result = await onReveal()
      setValue(result.idNumber)
    } catch (err) {
      setError(getErrorMessage(err))
      if (err?.status === 429) setCooldown(err.retryAfter ?? 60)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={styles.secret}>
      <span className={styles.secretValue}>{value ?? masked}</span>
      <Button variant="ghost" size="sm" iconOnly icon={value ? EyeOff : Eye} loading={busy} disabled={cooldown > 0} onClick={toggle}>
        {value ? 'Ẩn số giấy tờ' : 'Hiện số giấy tờ'}
      </Button>
      {error && <span className={styles.secretError}>{error}</span>}
    </span>
  )
}

/** Hộp thoại mật khẩu tạm — chỉ hiện đúng 1 lần (tạo tài khoản / cấp lại mật khẩu). */
export function TempPasswordDialog({ data, onClose, title = 'Mật khẩu tạm' }) {
  return (
    <Modal
      open={Boolean(data)}
      onClose={onClose}
      title={title}
      size="sm"
      footer={<Button onClick={onClose}>Tôi đã lưu lại</Button>}
    >
      {data && (
        <div className={styles.tempPassword}>
          <Alert tone="warning">
            Mật khẩu tạm <strong>chỉ hiện lần này</strong>. Hệ thống không gửi email/SMS — hãy tự gửi cho người dùng.
          </Alert>
          <div className={styles.credential}>
            <span className={styles.credentialLabel}>Tên đăng nhập</span>
            <code className={styles.credentialValue}>{data.username}</code>
            <CopyButton value={data.username} />
          </div>
          <div className={styles.credential}>
            <span className={styles.credentialLabel}>Mật khẩu tạm</span>
            <code className={styles.credentialValue}>{data.temporaryPassword}</code>
            <CopyButton value={data.temporaryPassword} />
          </div>
          <p className={styles.note}>
            {data.expiresAt ? `Hết hạn lúc ${formatDateTime(data.expiresAt)}. ` : 'Hết hạn sau 72 giờ. '}
            Người dùng phải đổi mật khẩu ở lần đăng nhập đầu.
          </p>
        </div>
      )}
    </Modal>
  )
}
