import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { queryKeys, rentersApi } from '@/api'
import { Badge, Button, DataTable, DateField, EmptyState, FormDialog, QueryView, Section, SelectField, TextField, useToast } from '@/components/ui'
import { CONSENT_METHOD_LABELS, toOptions } from '@/constants/enums'
import { useInvalidate } from '@/hooks/useAction'
import { blankToNull } from '@/hooks/useForm'
import { formatDate, todayVN } from '@/lib/format'

/**
 * Sổ ghi nhận đồng ý xử lý dữ liệu cá nhân (renters.md#ghi-nhận-đồng-ý): người thuê đã đồng ý cho dùng dữ liệu vào mục đích gì, bằng cách nào.
 * Chỉ là ghi nhận để xuất trình khi cần — không chặn nghiệp vụ nào. Rút lại giữ nguyên dòng, ghi ngày rút (muốn xóa dữ liệu thì dùng Ẩn danh).
 * Hồ sơ đã ẩn danh: chỉ xem, không ghi thêm.
 */
export function ConsentsSection({ renter }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const [dialog, setDialog] = useState(null) // { type: 'add' } | { type: 'withdraw', consent }
  const readOnly = Boolean(renter.anonymizedAt)
  const query = useQuery({
    queryKey: queryKeys.renters.consents(renter.id),
    queryFn: ({ signal }) => rentersApi.consents(renter.id, { signal }),
  })
  const consent = dialog?.consent

  const columns = [
    { key: 'purpose', header: 'Mục đích', primary: true, cell: (c) => <strong>{c.purpose}</strong> },
    { key: 'method', header: 'Cách đồng ý', cell: (c) => CONSENT_METHOD_LABELS[c.method] ?? c.method },
    { key: 'given', header: 'Ngày đồng ý', cell: (c) => formatDate(c.givenAt) },
    { key: 'status', header: 'Trạng thái', cell: (c) => (c.withdrawnAt ? <Badge>Đã rút lại {formatDate(c.withdrawnAt)}</Badge> : <Badge tone="success">Còn hiệu lực</Badge>) },
    { key: 'note', header: 'Ghi chú', hideOnMobile: true, cell: (c) => c.note ?? '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) =>
        !c.withdrawnAt && !readOnly ? (
          <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'withdraw', consent: c })}>
            Rút lại
          </Button>
        ) : null,
    },
  ]

  return (
    <Section
      title="Đồng ý xử lý dữ liệu cá nhân"
      description="Ghi lại việc người thuê đã đồng ý cho dùng dữ liệu cá nhân — để xuất trình khi cần."
      actions={
        !readOnly && (
          <Button size="sm" icon={Plus} onClick={() => setDialog({ type: 'add' })}>
            Ghi nhận đồng ý
          </Button>
        )
      }
    >
      <QueryView query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Chưa có ghi nhận đồng ý" />} errorTitle="Không tải được ghi nhận đồng ý">
        {(consents) => <DataTable columns={columns} rows={consents} caption="Ghi nhận đồng ý" />}
      </QueryView>

      {dialog?.type === 'add' && (
        <FormDialog
          title="Ghi nhận đồng ý"
          initial={{ purpose: '', method: 'ContractClause', givenAt: todayVN(), note: '' }}
          validate={(v) => ({
            purpose: !v.purpose.trim() ? 'Nhập mục đích.' : null,
            givenAt: !v.givenAt ? 'Chọn ngày đồng ý.' : v.givenAt > todayVN() ? 'Ngày đồng ý không ở tương lai.' : null,
          })}
          codeFields={{ INVALID_DATE: 'givenAt', RENTER_ANONYMIZED: 'purpose' }}
          submitLabel="Ghi nhận"
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await rentersApi.addConsent(renter.id, { purpose: v.purpose.trim(), method: v.method, givenAt: v.givenAt, note: blankToNull(v.note) })
            await invalidate(queryKeys.renters.consents(renter.id))
            toast.success('Đã ghi nhận đồng ý.')
          }}
        >
          {(form) => (
            <>
              <TextField label="Mục đích" required maxLength={100} placeholder="VD Quản lý hợp đồng thuê, Đăng ký tạm trú" {...form.field('purpose')} />
              <SelectField label="Cách đồng ý" options={toOptions(CONSENT_METHOD_LABELS)} {...form.field('method')} />
              <DateField label="Ngày đồng ý" required {...form.field('givenAt')} />
              <TextField label="Ghi chú" maxLength={500} placeholder="VD Điều 9 hợp đồng" {...form.field('note')} />
            </>
          )}
        </FormDialog>
      )}
      {dialog?.type === 'withdraw' && (
        <FormDialog
          title="Người thuê rút lại đồng ý?"
          description={`"${consent.purpose}" — đồng ý ngày ${formatDate(consent.givenAt)}. Dòng được giữ lại kèm ngày rút; đây chỉ là ghi nhận, không xóa dữ liệu.`}
          initial={{ withdrawnOn: todayVN() }}
          validate={(v) => ({
            withdrawnOn: !v.withdrawnOn ? 'Chọn ngày rút lại.' : v.withdrawnOn > todayVN() ? 'Ngày rút không ở tương lai.' : v.withdrawnOn < consent.givenAt ? 'Không trước ngày đồng ý.' : null,
          })}
          codeFields={{ INVALID_WITHDRAW_DATE: 'withdrawnOn' }}
          submitLabel="Ghi nhận rút lại"
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            try {
              await rentersApi.withdrawConsent(renter.id, consent.id, v.withdrawnOn)
            } catch (error) {
              // Đã rút ở nơi khác / dòng không còn → tải lại danh sách.
              if (['CONSENT_ALREADY_WITHDRAWN', 'CONSENT_NOT_FOUND'].includes(error.code)) void invalidate(queryKeys.renters.consents(renter.id))
              throw error
            }
            await invalidate(queryKeys.renters.consents(renter.id))
            toast.success('Đã ghi nhận rút lại đồng ý.')
          }}
        >
          {(form) => <DateField label="Ngày rút lại" required {...form.field('withdrawnOn')} />}
        </FormDialog>
      )}
    </Section>
  )
}
