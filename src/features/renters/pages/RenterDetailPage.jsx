import { useQuery } from '@tanstack/react-query'
import { Pencil, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { contractsApi, queryKeys, rentersApi } from '@/api'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  PageHeader,
  QueryView,
  SecretValue,
  Section,
  StatusBadge,
} from '@/components/ui'
import { CONTRACT_STATUS, GENDER_LABELS, ID_DOCUMENT_TYPE_LABELS } from '@/constants/enums'
import { Can } from '@/features/auth/access'
import { useCanViewSensitiveData } from '@/features/auth/AuthContext'
import { Permission } from '@/features/auth/permissions'
import { formatContractTerm } from '@/features/contracts/contractRules'
import { useAction } from '@/hooks/useAction'
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

function idDocument(r, onReveal) {
  if (!r.idType) return 'Chưa có giấy tờ'
  return (
    <>
      {ID_DOCUMENT_TYPE_LABELS[r.idType] ?? r.idType} <SecretValue masked={r.idNumberMasked} onReveal={onReveal} />
    </>
  )
}

/**
 * Ẩn danh ngay (docs/api/renters.md#chi-tiết) — chỉ chủ trọ, KHÔNG đảo ngược ⇒ hỏi xác nhận 2 lần:
 * bước 1 giải thích hậu quả, bước 2 nhập lý do + gõ đúng họ tên.
 */
function AnonymizeDialogs({ renter, step, setStep }) {
  const anonymize = useAction({
    mutationFn: (reason) => rentersApi.anonymize(renter.id, { reason }),
    invalidate: [queryKeys.renters.all, queryKeys.contracts.all],
    success: 'Đã ẩn danh hồ sơ.',
    toastErrors: false,
  })
  return (
    <>
      <ConfirmDialog
        open={step === 1}
        // ConfirmDialog tự đóng sau onConfirm — chỉ về 0 khi người dùng hủy ở bước 1, không phá bước 2.
        onClose={() => setStep((s) => (s === 1 ? 0 : s))}
        title="Ẩn danh hồ sơ người thuê?"
        message="Xóa vĩnh viễn thông tin cá nhân (họ tên, ngày sinh, giấy tờ, SĐT, địa chỉ…) và biển số các xe đã kết thúc của người này. Lịch sử hợp đồng, phiếu, thanh toán vẫn giữ nhưng không còn nhận ra người. Không thể khôi phục."
        confirmLabel="Tiếp tục"
        tone="danger"
        onConfirm={async () => setStep(2)}
      />
      <ConfirmDialog
        open={step === 2}
        onClose={() => setStep(0)}
        title="Xác nhận lần 2 — ẩn danh vĩnh viễn"
        message="Chỉ thực hiện được khi người này không còn hợp đồng đang chạy, không còn nợ / phiếu chờ hoàn."
        confirmLabel="Ẩn danh vĩnh viễn"
        tone="danger"
        reasonLabel="Lý do"
        confirmText={renter.fullName}
        onConfirm={(reason) => anonymize.mutateAsync(reason)}
      />
    </>
  )
}

// docs/api/renters.md#chi-tiết — tab "Lịch sử thuê": hợp đồng người này đứng tên HOẶC ở cùng.
export default function RenterDetailPage() {
  const { id } = useParams()
  const query = useRenter(id)
  const canViewSensitive = useCanViewSensitiveData()
  const [editing, setEditing] = useState(false)
  const [anonymizeStep, setAnonymizeStep] = useState(0) // 0 đóng · 1 cảnh báo · 2 xác nhận
  const contracts = useQuery({
    queryKey: queryKeys.contracts.list({ renterId: id, pageSize: 50 }),
    queryFn: ({ signal }) => contractsApi.list({ renterId: id, page: 1, pageSize: 50 }, { signal }),
  })

  return (
    <QueryView query={query} loading="page" errorTitle="Không tải được hồ sơ">
      {(r) => {
        const anonymized = Boolean(r.anonymizedAt)
        const reveal = canViewSensitive && !anonymized ? () => rentersApi.revealIdNumber(r.id) : undefined
        return (
          <>
            <PageHeader
              backTo="/renters"
              backLabel="Người thuê"
              title={r.fullName}
              meta={anonymized ? <Badge>Đã ẩn danh</Badge> : null}
              description={anonymized ? undefined : `Sinh ${formatDate(r.dateOfBirth)} · ${GENDER_LABELS[r.gender] ?? r.gender}`}
              actions={
                !anonymized && (
                  <>
                    <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                      Sửa hồ sơ
                    </Button>
                    <Can permission={Permission.RentersAnonymize}>
                      <Button variant="ghost" icon={UserX} onClick={() => setAnonymizeStep(1)}>
                        Ẩn danh
                      </Button>
                    </Can>
                  </>
                )
              }
            />

            {anonymized ? (
              <Alert tone="info">
                Hồ sơ đã được ẩn danh lúc {formatDateTime(r.anonymizedAt)} — thông tin cá nhân đã bị xóa, không sửa / xem số giấy tờ được và không
                chọn được cho hợp đồng mới. Người này thuê lại thì tạo hồ sơ mới.
              </Alert>
            ) : (
              <Section title="Hồ sơ">
                <DescriptionList
                  items={[
                    { label: 'Số điện thoại', value: r.phone },
                    { label: 'Email', value: r.email },
                    { label: 'Giấy tờ', value: idDocument(r, reveal) },
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
            )}

            <Section title="Lịch sử thuê" description="Hợp đồng người này đứng tên hoặc ở cùng." padded={false}>
              <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
                <QueryView query={contracts} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="Chưa có hợp đồng" />}>
                  {(data) => <DataTable columns={CONTRACT_COLUMNS} rows={data.items} rowHref={(c) => `/contracts/${c.id}`} caption="Lịch sử thuê" />}
                </QueryView>
              </div>
            </Section>

            {editing && <RenterFormDialog renter={r} onClose={() => setEditing(false)} />}
            {!anonymized && <AnonymizeDialogs renter={r} step={anonymizeStep} setStep={setAnonymizeStep} />}
          </>
        )
      }}
    </QueryView>
  )
}
