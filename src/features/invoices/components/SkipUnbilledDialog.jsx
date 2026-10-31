import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { metersApi, queryKeys } from '@/api'
import { Alert, Button, CheckboxField, Modal, QueryView } from '@/components/ui'
import { ReadingSheet } from '@/features/meters/components/ReadingSheet'
import { addBillingMonths, formatBillingMonth } from '@/lib/format'
import { getErrorMessage } from '@/lib/http/ApiError'
import { describeUnbilled } from '../invoiceRules'

const listStyle = { margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)' }

/** Lưới chỉ số chốt kỳ cuối khoảng của một khu — chỉ các hợp đồng sắp bỏ qua kỳ (chỉ số đầu của kỳ sẽ lập, BL-BR-44). */
function PropertySheet({ group, closingMonth }) {
  const params = { billingMonth: closingMonth }
  const query = useQuery({
    queryKey: queryKeys.meters.sheet(group.propertyId, params),
    queryFn: ({ signal }) => metersApi.readingSheet(group.propertyId, params, { signal }),
  })
  const contractIds = new Set(group.items.map((i) => i.contractId))
  return (
    <QueryView query={query} isEmpty={(d) => d.rows.filter((r) => contractIds.has(r.contractId)).length === 0} errorTitle="Không tải được lưới chỉ số">
      {(data) => (
        <ReadingSheet
          key={`${group.propertyId}|${closingMonth}`}
          propertyId={group.propertyId}
          billingMonth={closingMonth}
          rows={data.rows.filter((r) => contractIds.has(r.contractId))}
        />
      )}
    </QueryView>
  )
}

/**
 * Hộp thoại "Bỏ qua các kỳ chưa lập" (invoices.md#bỏ-qua-các-kỳ-chưa-lập--thu-tay-ngoài-hệ-thống): chủ trọ ngừng dùng phần mềm vài kỳ, thu tay ngoài,
 * nay dùng lại. Xác nhận ⇒ tạo lại với `skipUnbilledPeriods`: mỗi hợp đồng ghi 1 khoảng ngắt rồi lập phiếu kỳ này.
 * items: [{ propertyId, propertyLabel, contractId, label, periods: [{ start, end }] }] — các hợp đồng đang thiếu phiếu kỳ trước.
 * Chỉ số đầu kỳ = chỉ số chốt kỳ cuối khoảng (tháng liền trước tháng thu) — nhập ngay trong lưới bên dưới.
 */
export function SkipUnbilledDialog({ billingMonth, items, onConfirm, onClose }) {
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const closingMonth = addBillingMonths(billingMonth, -1)
  const groups = []
  for (const item of items) {
    const group = groups.find((g) => g.propertyId === item.propertyId)
    if (group) group.items.push(item)
    else groups.push({ propertyId: item.propertyId, propertyLabel: item.propertyLabel, items: [item] })
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(getErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Bỏ qua kỳ chưa lập để tạo phiếu ${formatBillingMonth(billingMonth).toLowerCase()}`}
      description={`${items.length} hợp đồng chưa có phiếu các kỳ trước.`}
      size="xl"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Quay lại
          </Button>
          <Button onClick={submit} loading={busy} disabled={!confirmed}>
            Bỏ qua {items.reduce((n, i) => n + i.periods.length, 0)} kỳ và tạo phiếu
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <Alert tone="warning">
          Các kỳ dưới đây sẽ coi như <strong>đã thu ngoài hệ thống</strong>: không có phiếu, không có công nợ, điện nước các kỳ đó không tính cho ai. Chỉ số đầu của phiếu{' '}
          {formatBillingMonth(billingMonth).toLowerCase()} là <strong>chỉ số chốt {formatBillingMonth(closingMonth).toLowerCase()}</strong> — nhập vào lưới bên dưới (nếu chưa có).
          Làm nhầm thì xóa nháp / hủy phiếu vừa tạo, các kỳ bỏ qua sẽ trở lại.
        </Alert>
        {groups.map((group) => (
          <section key={group.propertyId} style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <h3 style={{ margin: 0 }}>Khu {group.propertyLabel}</h3>
            <ul style={{ ...listStyle, margin: 0 }}>
              {group.items.map((i) => (
                <li key={i.contractId}>
                  {i.label}: {describeUnbilled(i.periods)}
                </li>
              ))}
            </ul>
            <PropertySheet group={group} closingMonth={closingMonth} />
          </section>
        ))}
        <CheckboxField
          label="Tôi xác nhận các kỳ trên đã thu ngoài hệ thống"
          description="Mỗi hợp đồng chỉ bỏ qua được tối đa 12 kỳ; khu thu trước hoặc có đổi ngày chốt trong các kỳ đó không dùng được."
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  )
}
