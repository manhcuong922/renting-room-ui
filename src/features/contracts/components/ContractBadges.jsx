import { Badge, StatusBadge } from '@/components/ui'
import { CONTRACT_FLAGS, CONTRACT_STATUS } from '@/constants/enums'

/** Trạng thái + "Không cọc" (cọc = 0) + cờ việc cần xử lý (flags — đã gồm "Quá hạn — chờ quyết định"). */
export function ContractBadges({ contract, showDeposit = true }) {
  const flags = contract.flags ?? []
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
      <StatusBadge map={CONTRACT_STATUS} value={contract.status} />
      {contract.isOverdue && !flags.includes('ExpiredAwaitingDecision') && !flags.includes('Holdover') && <Badge tone="danger">Quá hạn</Badge>}
      {showDeposit && contract.depositAmount === 0 && <Badge tone="warning">Không cọc</Badge>}
      <ContractFlagBadges flags={flags} />
    </span>
  )
}

/** Nhãn việc cần xử lý của HĐ đang hiệu lực (contracts.md#cần-xử-lý-flags) — dùng trên danh sách HĐ và ô phòng. */
export function ContractFlagBadges({ flags, exclude = [] }) {
  return (flags ?? [])
    .filter((f) => !exclude.includes(f))
    .map((f) => (
      <Badge key={f} tone={CONTRACT_FLAGS[f]?.tone ?? 'neutral'}>
        {CONTRACT_FLAGS[f]?.label ?? f}
      </Badge>
    ))
}
