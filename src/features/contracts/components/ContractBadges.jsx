import { Badge, StatusBadge } from '@/components/ui'
import { CONTRACT_STATUS } from '@/constants/enums'

/** Trạng thái + "Quá hạn" (Active đã qua endDate) + "Không cọc" (cọc = 0). */
export function ContractBadges({ contract, showDeposit = true }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
      <StatusBadge map={CONTRACT_STATUS} value={contract.status} />
      {contract.isOverdue && <Badge tone="danger">Quá hạn</Badge>}
      {showDeposit && contract.depositAmount === 0 && <Badge tone="warning">Không cọc</Badge>}
    </span>
  )
}
