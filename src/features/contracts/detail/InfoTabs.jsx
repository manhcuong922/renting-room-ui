import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { propertiesApi, queryKeys } from '@/api'
import { Alert, Badge, Button, DataTable, DescriptionList, EmptyState, QueryView, Section } from '@/components/ui'
import {
  CHARGE_MODE_LABELS,
  CONTRACT_TYPE_LABELS,
  CONTRACT_WARNING_LABELS,
  ID_DOCUMENT_TYPE_LABELS,
  LESSOR_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PRORATION_MODE_LABELS,
  TERMINATION_GROUND_LABELS,
  TERMINATION_REASON_LABELS,
} from '@/constants/enums'
import { formatBillingMonth, formatDate, formatDateTime, formatMoney, todayVN } from '@/lib/format'
import { formatContractTerm } from '../contractRules'
import { formatCustomValue } from '../contractForm'
import { useBillingPeriods } from '../hooks'

export function OverviewTab({ contract: c, actions, onEditNote }) {
  return (
    <>
      {c.warnings?.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert tone="warning">
            {c.warnings.map((w) => (
              <div key={w.code}>{w.message ?? CONTRACT_WARNING_LABELS[w.code] ?? w.code}</div>
            ))}
          </Alert>
        </div>
      )}
      <Section title="Thời hạn & tiền thuê">
        <DescriptionList
          items={[
            { label: 'Loại hợp đồng', value: CONTRACT_TYPE_LABELS[c.document?.contractType] },
            { label: 'Thời hạn', value: formatContractTerm({ ...c, actualEndDate: null }) },
            { label: 'Ngày ký · nơi ký', value: [c.signedDate && formatDate(c.signedDate), c.signedPlace].filter(Boolean).join(' · ') || 'Chốt khi kích hoạt' },
            { label: 'Ngày hiệu lực', value: c.effectiveDate ? formatDate(c.effectiveDate) : null },
            { label: 'Giá thuê hiện tại', value: formatMoney(c.currentRent) },
            { label: 'Tiền cọc', value: c.depositAmount ? formatMoney(c.depositAmount) : 'Không cọc' },
            { label: 'Điều kiện hoàn cọc', value: c.depositTerms, full: true },
          ]}
        />
      </Section>
      <Section title="Cài đặt thu">
        <DescriptionList
          items={[
            { label: 'Ngày chốt kỳ thu', value: `Ngày ${c.billing.anchorDay}` },
            { label: 'Thu tiền phòng', value: CHARGE_MODE_LABELS[c.billing.chargeMode] },
            { label: 'Hạn đóng', value: `${c.billing.paymentDueDays} ngày sau ngày chốt` },
            { label: 'Tháng lẻ', value: PRORATION_MODE_LABELS[c.billing.prorationMode] },
            { label: 'Báo trước khi trả phòng', value: `${c.noticeDays} ngày` },
            { label: 'Phương thức thanh toán', value: c.paymentMethods.map((m) => PAYMENT_METHOD_LABELS[m]).join(', ') },
            { label: 'Số bản hợp đồng', value: c.copiesCount },
          ]}
        />
      </Section>
      {(c.terminationReason || c.cancelReason || c.noticeGivenDate) && (
        <Section title="Kết thúc">
          <DescriptionList
            items={[
              { label: 'Ngày báo trả phòng', value: c.noticeGivenDate ? formatDate(c.noticeGivenDate) : null, hidden: !c.noticeGivenDate },
              { label: 'Dự kiến trả phòng', value: c.plannedMoveOutDate ? formatDate(c.plannedMoveOutDate) : null, hidden: !c.plannedMoveOutDate },
              { label: 'Ngày trả phòng thực tế', value: c.actualEndDate ? formatDate(c.actualEndDate) : null, hidden: !c.actualEndDate },
              { label: 'Lý do chấm dứt', value: TERMINATION_REASON_LABELS[c.terminationReason], hidden: !c.terminationReason },
              { label: 'Căn cứ', value: TERMINATION_GROUND_LABELS[c.terminationGround], hidden: !c.terminationGround },
              { label: 'Ghi chú chấm dứt', value: c.terminationNote, hidden: !c.terminationNote, full: true },
              { label: 'Lý do hủy nháp', value: c.cancelReason, hidden: !c.cancelReason, full: true },
            ]}
          />
        </Section>
      )}
      <Section
        title="Ghi chú nội bộ"
        actions={
          actions.editNote && (
            <Button size="sm" variant="ghost" icon={Pencil} onClick={onEditNote}>
              Sửa
            </Button>
          )
        }
      >
        <p style={{ whiteSpace: 'pre-line', color: c.note ? undefined : 'var(--color-text-muted)' }}>{c.note || 'Chưa có ghi chú.'}</p>
      </Section>
      <Section title="Lịch sử">
        <DescriptionList
          items={[
            { label: 'Kích hoạt lúc', value: c.activatedAt ? formatDateTime(c.activatedAt) : null },
            { label: 'Kết thúc lúc', value: c.endedAt ? formatDateTime(c.endedAt) : null, hidden: !c.endedAt },
            { label: 'Hủy lúc', value: c.cancelledAt ? formatDateTime(c.cancelledAt) : null, hidden: !c.cancelledAt },
          ]}
        />
      </Section>
    </>
  )
}

function LessorList({ lessor }) {
  const individual = lessor.type === 'Individual'
  return (
    <DescriptionList
      items={[
        { label: 'Loại', value: LESSOR_TYPE_LABELS[lessor.type] },
        { label: individual ? 'Họ tên' : 'Tên tổ chức', value: lessor.name },
        { label: 'Địa chỉ', value: lessor.address },
        { label: 'Điện thoại', value: lessor.phone },
        { label: 'Giấy tờ', value: individual ? `${ID_DOCUMENT_TYPE_LABELS[lessor.idType] ?? ''} ${lessor.idNumberMasked ?? ''}` : null, hidden: !individual },
        { label: 'Ngày sinh', value: lessor.dateOfBirth ? formatDate(lessor.dateOfBirth) : null, hidden: !individual },
        { label: 'Mã số thuế', value: lessor.taxCode, hidden: individual },
        { label: 'Người đại diện', value: [lessor.representativeName, lessor.representativeTitle].filter(Boolean).join(' — '), hidden: individual },
        {
          label: 'Ngân hàng',
          value: lessor.bankAccount ? `${lessor.bankAccount.bankName} · ${lessor.bankAccount.accountNo} · ${lessor.bankAccount.accountName}` : null,
          hidden: lessor.bankAccount === undefined,
        },
      ]}
    />
  )
}

/** Các bên: bản chụp lúc ký. Nháp → hiện dữ liệu hiện tại của khu/phòng (sẽ chốt khi kích hoạt). */
export function PartiesTab({ contract: c }) {
  const draft = c.status === 'Draft'
  const property = useQuery({
    queryKey: queryKeys.properties.detail(c.propertyId),
    queryFn: ({ signal }) => propertiesApi.get(c.propertyId, { signal }),
    enabled: draft,
  })
  return (
    <>
      {draft && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert tone="info">Hợp đồng nháp: thông tin dưới đây là dữ liệu hiện tại và sẽ được chốt (chụp lại) khi kích hoạt.</Alert>
        </div>
      )}
      <Section
        title="Bên cho thuê (bên A)"
        description={c.lessor ? `${c.lessor.propertyName} — chụp lúc ${formatDateTime(c.lessor.capturedAt)}` : undefined}
        actions={
          draft && (
            <Link to={`/properties/${c.propertyId}?tab=lessor`} style={{ fontSize: 'var(--text-sm)' }}>
              Sửa bên cho thuê
            </Link>
          )
        }
      >
        {c.lessor && <LessorList lessor={c.lessor} />}
        {!c.lessor && draft && property.data?.lessor && <LessorList lessor={{ ...property.data.lessor, bankAccount: property.data.bankAccount }} />}
        {!c.lessor && draft && property.data && !property.data.lessor && <Alert tone="warning">Khu chưa khai báo bên cho thuê — chưa kích hoạt được.</Alert>}
      </Section>
      <Section title="Bên thuê (bên B)">
        {c.representativeAtSigning ? (
          <DescriptionList
            items={[
              { label: 'Họ tên', value: c.representativeAtSigning.fullName },
              { label: 'Ngày sinh', value: formatDate(c.representativeAtSigning.dateOfBirth) },
              { label: 'Giấy tờ', value: `${ID_DOCUMENT_TYPE_LABELS[c.representativeAtSigning.idType] ?? ''} ${c.representativeAtSigning.idNumberMasked ?? ''}` },
              { label: 'Điện thoại', value: c.representativeAtSigning.phone },
              { label: 'Thường trú', value: c.representativeAtSigning.permanentAddress, full: true },
            ]}
          />
        ) : (
          <p>
            <Link to={`/renters/${c.representativeRenterId}`}>{c.representativeName}</Link>{' '}
            <span style={{ color: 'var(--color-text-muted)' }}>(chốt hồ sơ khi kích hoạt)</span>
          </p>
        )}
      </Section>
      <Section title="Phòng">
        <DescriptionList
          items={[
            { label: 'Khu / phòng', value: <Link to={`/rooms/${c.roomId}`}>{`${c.propertyCode} · Phòng ${c.roomCode}`}</Link> },
            { label: 'Tầng', value: c.roomAtSigning?.floor },
            { label: 'Diện tích', value: c.roomAtSigning?.areaM2 ? `${c.roomAtSigning.areaM2} m²` : null },
            { label: 'Sức chứa', value: c.roomAtSigning?.maxOccupants ? `${c.roomAtSigning.maxOccupants} người` : null },
          ]}
        />
      </Section>
    </>
  )
}

export function RentTermsTab({ contract: c, actions, onAdd }) {
  const today = todayVN()
  const currentId = [...c.rentTerms].reverse().find((t) => t.effectiveFrom <= today)?.id
  const columns = [
    {
      key: 'from',
      header: 'Áp dụng từ',
      primary: true,
      cell: (t) => (
        <span>
          {formatDate(t.effectiveFrom)} {t.id === currentId && <Badge tone="success">Hiện hành</Badge>}
        </span>
      ),
    },
    { key: 'rent', header: 'Giá / tháng', align: 'right', cell: (t) => formatMoney(t.monthlyRent) },
    { key: 'no', header: 'Số phụ lục', cell: (t) => t.addendumNo ?? '—' },
    { key: 'note', header: 'Ghi chú', cell: (t) => t.note ?? '—' },
  ]
  return (
    <Section
      title="Giá thuê theo thời gian"
      description="Đổi giá qua phụ lục; không sửa giá niêm yết của phòng."
      actions={
        actions.changeRent && (
          <Button size="sm" icon={Plus} onClick={onAdd}>
            Phụ lục đổi giá
          </Button>
        )
      }
    >
      {c.rentTerms.length ? <DataTable columns={columns} rows={c.rentTerms} caption="Các mức giá" /> : <EmptyState title="Chưa có giá" />}
    </Section>
  )
}

export function BillingTab({ contract: c }) {
  const query = useBillingPeriods(c.id)
  const today = todayVN()
  const columns = [
    {
      key: 'month',
      header: 'Tháng thu',
      primary: true,
      cell: (p) => (
        <span>
          {formatBillingMonth(p.billingMonth)} {p.start <= today && today <= p.end && <Badge tone="info">Kỳ hiện tại</Badge>}
        </span>
      ),
    },
    { key: 'range', header: 'Từ – đến', cell: (p) => `${formatDate(p.start)} – ${formatDate(p.end)}` },
  ]
  return (
    <Section title="Kỳ thu" description="Kỳ chạy từ ngày chốt tới trước ngày chốt kế tiếp; kỳ đầu lẻ nếu ngày bắt đầu không trùng ngày chốt.">
      <QueryView query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Chưa có kỳ thu" />}>
        {(periods) => <DataTable columns={columns} rows={periods} rowKey={(p) => p.start} caption="Kỳ thu" />}
      </QueryView>
    </Section>
  )
}

export function RulesTab({ contract: c }) {
  return (
    <Section title="Nội quy" description={c.status === 'Draft' ? 'Nội quy của khu sẽ được chụp vào hợp đồng khi kích hoạt.' : 'Bản chụp lúc kích hoạt.'}>
      {c.houseRulesSnapshot ? <p style={{ whiteSpace: 'pre-line' }}>{c.houseRulesSnapshot}</p> : <p style={{ color: 'var(--color-text-muted)' }}>Không có nội quy.</p>}
    </Section>
  )
}

export function DocumentTab({ contract: c }) {
  const doc = c.document ?? {}
  const fields = doc.customFieldDefinitions ?? []
  return (
    <>
      <Section title={doc.title ?? 'Văn bản hợp đồng'} description={doc.templateId ? 'Nội dung chép từ mẫu lúc lập — không phụ thuộc mẫu hiện tại.' : undefined}>
        {(doc.clauses ?? []).length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Không có điều khoản theo mẫu.</p>}
        {(doc.clauses ?? []).map((cl, i) => (
          <article key={i} style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 4 }}>
              Điều {i + 1}. {cl.heading}
            </h3>
            <p style={{ whiteSpace: 'pre-line' }}>{cl.body}</p>
          </article>
        ))}
      </Section>
      {fields.length > 0 && (
        <Section title="Thông tin bổ sung">
          <DescriptionList items={fields.map((f) => ({ label: f.label, value: formatCustomValue(f, doc.customFields?.[f.key]) }))} />
        </Section>
      )}
      {c.termsText && (
        <Section title="Điều khoản bổ sung">
          <p style={{ whiteSpace: 'pre-line' }}>{c.termsText}</p>
        </Section>
      )}
    </>
  )
}
