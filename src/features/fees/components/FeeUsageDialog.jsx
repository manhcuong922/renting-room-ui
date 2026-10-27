import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { feesApi, queryKeys } from '@/api'
import { Alert, Badge, Button, CheckboxField, DataTable, FormGrid, Modal, MoneyField, NumberField, QueryView, useToast } from '@/components/ui'
import { useInvalidate } from '@/hooks/useAction'
import { formatDate, formatMoney } from '@/lib/format'
import { getErrorMessage } from '@/lib/http/ApiError'
import { validQuantity } from '../feeForm'

const MAX_CONTRACTS = 500

/**
 * Phòng đang dùng dịch vụ — thêm / bớt hàng loạt (fees.md#phòng-đang-dùng-dịch-vụ, FE-UC-08).
 * Mỗi hợp đồng áp từ kỳ chưa lập phiếu đầu tiên của nó và lưu riêng: hợp đồng lỗi không làm hỏng hợp đồng khác → hiện kết quả từng phòng.
 * Phòng trống (không có hợp đồng) không chọn được.
 */
export function FeeUsageDialog({ fee, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const perUnit = fee.chargeBasis === 'PerUnit'
  const [selected, setSelected] = useState(() => new Set())
  const [quantity, setQuantity] = useState(perUnit ? (fee.defaultQuantity ?? 1) : null)
  const [override, setOverride] = useState(null)
  const [busy, setBusy] = useState(null) // 'Add' | 'Remove'
  const [failures, setFailures] = useState({}) // contractId → câu lỗi của lần gửi gần nhất

  const query = useQuery({
    queryKey: queryKeys.fees.usage(fee.id),
    queryFn: ({ signal }) => feesApi.usage(fee.id, { signal }),
  })
  const rows = useMemo(() => query.data ?? [], [query.data])
  const selectable = useMemo(() => rows.filter((r) => r.contractId), [rows])
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.contractId))
  const quantityError = perUnit && quantity !== null && !validQuantity(quantity) ? 'Số gói lớn hơn 0, tối đa 100.' : null

  const toggle = (contractId) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(contractId)) next.delete(contractId)
      else next.add(contractId)
      return next
    })

  const apply = async (action) => {
    const contractIds = [...selected]
    setBusy(action)
    try {
      const results = await feesApi.changeUsage(fee.id, {
        action,
        contractIds,
        quantity: action === 'Add' && perUnit ? quantity : null,
        unitPriceOverride: action === 'Add' ? override : null,
      })
      const failed = results.filter((r) => !r.succeeded)
      setFailures(Object.fromEntries(failed.map((r) => [r.contractId, r.errorMessage ?? r.errorCode])))
      // Giữ lại các phòng lỗi đang chọn để người dùng xử lý tiếp.
      setSelected(new Set(failed.map((r) => r.contractId)))
      await invalidate(queryKeys.fees.usage(fee.id), queryKeys.contracts.all, queryKeys.invoices.all)
      const done = results.length - failed.length
      const verb = action === 'Add' ? 'thêm' : 'bớt'
      if (done > 0) toast.success(`Đã ${verb} "${fee.name}" cho ${done} phòng.`)
      if (failed.length > 0) toast.error(`${failed.length} phòng không ${verb} được — xem lý do ở từng dòng.`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const columns = [
    {
      key: 'room',
      header: (
        <CheckboxField
          label="Phòng"
          checked={allSelected}
          disabled={selectable.length === 0}
          onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((r) => r.contractId)) : new Set())}
        />
      ),
      primary: true,
      cell: (r) =>
        r.contractId ? (
          <CheckboxField label={`${r.roomCode}${r.floor ? ` · tầng ${r.floor}` : ''}`} checked={selected.has(r.contractId)} onChange={() => toggle(r.contractId)} />
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>
            {r.roomCode}
            {r.floor ? ` · tầng ${r.floor}` : ''}
          </span>
        ),
    },
    { key: 'contract', header: 'Hợp đồng', cell: (r) => (r.contractId ? `${r.contractNo} — ${r.representativeName ?? ''}` : 'Phòng trống') },
    {
      key: 'using',
      header: 'Đang dùng',
      cell: (r) => {
        if (failures[r.contractId]) return <span style={{ color: 'var(--color-danger)' }}>{failures[r.contractId]}</span>
        if (!r.isUsing) return '—'
        return (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Badge tone="success">Đang dùng</Badge>
            {perUnit && r.quantity !== null && `${r.quantity} ${fee.unit}`}
            {r.unitPriceOverride !== null && `giá riêng ${formatMoney(r.unitPriceOverride)}`}
            {r.effectiveFrom && `từ ${formatDate(r.effectiveFrom)}`}
          </span>
        )
      },
    },
  ]

  const count = selected.size
  const tooMany = count > MAX_CONTRACTS

  return (
    <Modal
      open
      onClose={onClose}
      title={`Phòng đang dùng — ${fee.name}`}
      description="Thêm hoặc bớt dịch vụ cho nhiều phòng một lúc, áp từ kỳ chưa lập phiếu đầu tiên của từng phòng."
      size="lg"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={Boolean(busy)}>
            Đóng
          </Button>
          <Button variant="secondary" disabled={count === 0 || tooMany || busy === 'Add'} loading={busy === 'Remove'} onClick={() => apply('Remove')}>
            Bớt cho {count} phòng
          </Button>
          <Button disabled={count === 0 || tooMany || Boolean(quantityError) || busy === 'Remove'} loading={busy === 'Add'} onClick={() => apply('Add')}>
            Thêm cho {count} phòng
          </Button>
        </>
      }
    >
      <QueryView query={query} loading="page" errorTitle="Không tải được danh sách phòng">
        {() => (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <FormGrid>
              {perUnit && (
                <NumberField label={`Số gói (${fee.unit})`} decimals={2} error={quantityError} hint="Dùng khi Thêm — phòng đang dùng sẽ đổi sang số này" value={quantity} onChange={setQuantity} />
              )}
              <MoneyField
                label="Giá riêng cho các phòng chọn"
                hint={`Bỏ trống = theo bảng giá của khu${fee.currentPrice ? ` (${formatMoney(fee.currentPrice.unitPrice)}/${fee.unit})` : ''}`}
                value={override}
                onChange={setOverride}
              />
            </FormGrid>
            {tooMany && <Alert tone="warning">Mỗi lần tối đa {MAX_CONTRACTS} phòng.</Alert>}
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.roomId} caption="Phòng của khu" />
          </div>
        )}
      </QueryView>
    </Modal>
  )
}
