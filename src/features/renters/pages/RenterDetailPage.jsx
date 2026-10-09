import { useQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { contractsApi, queryKeys, rentersApi } from '@/api'
import { Button, DataTable, DescriptionList, EmptyState, PageHeader, QueryView, SecretValue, Section, StatusBadge } from '@/components/ui'
import { CONTRACT_STATUS, GENDER_LABELS, ID_DOCUMENT_TYPE_LABELS } from '@/constants/enums'
import { useCanViewSensitiveData } from '@/features/auth/AuthContext'
import { formatContractTerm } from '@/features/contracts/contractRules'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { RenterFormDialog } from '../components/RenterFormDialog'
import { useRenter } from '../hooks'

const CONTRACT_COLUMNS = [
  { key: 'no', header: 'Số HĐ', primary: true, cell: (c) => <Link to={`/contracts/${c.id}`}>{c.contractNo}</Link> },
  { key: 'room', header: 'Phòng', cell: (c) => `${c.propertyCode} · ${c.roomCode}` },
  { key: 'role', header: 'Đứng tên', cell: (c) => c.representativeName },
  { key: 'term', header: 'Thời hạn', cell: formatContractTerm },
  { key: 'rent', header: 'Giá', align: 'right', cell: (c) => formatMoney(c.currentRent) },
  { key: 'status', header: 'Trạng thái', cell: (c) => <StatusBadge map={CONTRACT_STATUS} value={c.status} /> },
]

// docs/api/renters.md#chi-tiết — tab "Lịch sử thuê": hợp đồng người này đứng tên HOẶC ở cùng.
export default function RenterDetailPage() {
  const { id } = useParams()
  const query = useRenter(id)
  const canViewSensitive = useCanViewSensitiveData()
  const [editing, setEditing] = useState(false)
  const contracts = useQuery({
    queryKey: queryKeys.contracts.list({ renterId: id, pageSize: 50 }),
    queryFn: ({ signal }) => contractsApi.list({ renterId: id, page: 1, pageSize: 50 }, { signal }),
  })

  return (
    <QueryView query={query} loading="page" errorTitle="Không tải được hồ sơ">
      {(r) => (
        <>
          <PageHeader
            backTo="/renters"
            backLabel="Người thuê"
            title={r.fullName}
            description={`Sinh ${formatDate(r.dateOfBirth)} · ${GENDER_LABELS[r.gender] ?? r.gender}`}
            actions={
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                Sửa hồ sơ
              </Button>
            }
          />

          <Section title="Hồ sơ">
            <DescriptionList
              items={[
                { label: 'Số điện thoại', value: r.phone },
                { label: 'Email', value: r.email },
                { label: 'Loại giấy tờ', value: ID_DOCUMENT_TYPE_LABELS[r.idType] ?? r.idType },
                { label: 'Số giấy tờ', value: <SecretValue masked={r.idNumberMasked} onReveal={canViewSensitive ? () => rentersApi.revealIdNumber(r.id) : undefined} /> },
                { label: 'Ngày cấp', value: r.idIssueDate ? formatDate(r.idIssueDate) : null },
                { label: 'Nơi cấp', value: r.idIssuePlace },
                { label: 'Quốc tịch', value: r.nationality },
                { label: 'Nơi thường trú', value: r.permanentAddress },
                { label: 'Nghề nghiệp', value: r.occupation },
                { label: 'Nơi làm việc / học tập', value: r.workplace },
                { label: 'Liên hệ khẩn cấp', value: [r.emergencyContactName, r.emergencyContactPhone].filter(Boolean).join(' · ') },
                { label: 'Tạo lúc', value: formatDateTime(r.createdAt) },
                { label: 'Ghi chú', value: r.note, full: true },
              ]}
            />
          </Section>

          <Section title="Lịch sử thuê" description="Hợp đồng người này đứng tên hoặc ở cùng." padded={false}>
            <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
              <QueryView query={contracts} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="Chưa có hợp đồng" />}>
                {(data) => <DataTable columns={CONTRACT_COLUMNS} rows={data.items} rowHref={(c) => `/contracts/${c.id}`} caption="Lịch sử thuê" />}
              </QueryView>
            </div>
          </Section>

          {editing && <RenterFormDialog renter={r} onClose={() => setEditing(false)} />}
        </>
      )}
    </QueryView>
  )
}
