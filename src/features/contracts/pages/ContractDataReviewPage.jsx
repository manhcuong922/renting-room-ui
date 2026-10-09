import { ListChecks } from 'lucide-react'
import { Link } from 'react-router'
import { DataTable, EmptyState, PageHeader, QueryView, SelectField, Toolbar } from '@/components/ui'
import { usePropertyOptions } from '@/features/shared/queries'
import { useListParams } from '@/hooks/useListParams'
import { useContractDataReview } from '../hooks'

const DEFAULTS = { propertyId: '' }

const ISSUE_LABELS = {
  REPRESENTATIVE_UNDERAGE: 'Người đứng tên chưa đủ 18 tuổi',
  OCCUPANT_LIVES_ELSEWHERE: 'Một người ở 2 phòng',
  FEE_PRICE_MISSING: 'Khoản thu chưa có giá',
  GUARDIAN_CONSENT_REQUIRED: 'Thiếu đồng ý của người giám hộ',
  SPOUSE_UNDER_MARRIAGE_AGE: 'Vợ / chồng chưa đủ tuổi kết hôn',
  MULTIPLE_SPOUSES: 'Nhiều vợ / chồng',
}
const issueLabel = (code) => ISSUE_LABELS[code] ?? (code.startsWith('RELATIONSHIP_') ? 'Quan hệ người ở' : code)

const COLUMNS = [
  { key: 'no', header: 'Hợp đồng', primary: true, cell: (i) => <Link to={`/contracts/${i.contractId}`}>{i.contractNo}</Link> },
  { key: 'room', header: 'Khu / phòng', cell: (i) => `${i.propertyCode} · ${i.roomCode}` },
  { key: 'type', header: 'Vấn đề', cell: (i) => issueLabel(i.code) },
  { key: 'message', header: 'Chi tiết', cell: (i) => i.message },
  { key: 'renter', header: 'Người liên quan', cell: (i) => (i.renterId ? <Link to={`/renters/${i.renterId}`}>{i.renterName}</Link> : '—') },
]

// docs/api/contracts.md#dữ-liệu-cần-xem-lại — rà HĐ đang hiệu lực / thanh lý (chỉ đọc): quan hệ người ở, tuổi người ký,
// một người ở 2 phòng, khoản thu chưa có giá (sẽ không lập được phiếu).
export default function ContractDataReviewPage() {
  const { params, set } = useListParams(DEFAULTS)
  const properties = usePropertyOptions()
  const query = useContractDataReview(params.propertyId)

  return (
    <>
      <PageHeader
        backTo="/contracts"
        backLabel="Hợp đồng"
        title="Dữ liệu cần xem lại"
        description="Thường do sửa hồ sơ sau khi ký hoặc dữ liệu nhập từ sổ cũ. Không chặn thu tiền — trừ khoản thu chưa có giá."
      />
      <Toolbar>
        <SelectField
          aria-label="Khu"
          placeholder="Mọi khu"
          options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
          value={params.propertyId}
          onChange={(e) => set({ propertyId: e.target.value })}
        />
      </Toolbar>
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={ListChecks} title="Không có gì cần xem lại" description="Dữ liệu hợp đồng đang hiệu lực đều hợp lý." />}
      >
        {(issues) => (
          <DataTable columns={COLUMNS} rows={issues} rowKey={(i) => `${i.contractId}-${i.code}-${i.renterId ?? ''}-${i.message}`} caption="Dữ liệu cần xem lại" />
        )}
      </QueryView>
    </>
  )
}
