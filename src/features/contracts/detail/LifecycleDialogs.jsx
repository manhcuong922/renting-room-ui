import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { contractsApi, queryKeys, roomsApi } from '@/api'
import {
  Alert,
  Button,
  CheckboxField,
  DateField,
  FormDialog,
  FormGrid,
  FormSection,
  Modal,
  MoneyField,
  RadioGroup,
  SelectField,
  Spinner,
  TextAreaField,
  TextField,
  useToast,
} from '@/components/ui'
import { CONTRACT_WARNING_LABELS } from '@/constants/enums'
import { useRoomMeters } from '@/features/shared/queries'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { getErrorMessage } from '@/lib/http/ApiError'
import { addDays, formatBillingMonth, formatDate, formatMoney, todayVN } from '@/lib/format'
import { isCurrentOccupant } from '../contractRules'
import { useBillingPeriods } from '../hooks'
import { MeterReadingsFields } from './MeterReadingsFields'
import { initialReadings, readingErrorsFromApi, toReadingInputs, validateReadings } from './meterReadings'

function CheckList({ checks }) {
  return (
    <ul style={{ display: 'grid', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
      {checks.map((check) => (
        <li key={check.label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {check.ok === null && <Spinner size={16} />}
          {check.ok === true && <CircleCheck size={18} color="var(--color-success)" aria-label="Đạt" />}
          {check.ok === false && <CircleX size={18} color="var(--color-danger)" aria-label="Chưa đạt" />}
          {check.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * Kích hoạt (bàn giao phòng) — docs/api/contracts.md#kích-hoạt-bàn-giao-phòng.
 * Chặn: phòng bảo trì / ngừng dùng, ngày bắt đầu > ngày mai, chưa có người ở, trùng thời gian.
 * Bắt buộc chỉ số nhận phòng cho mỗi công tơ đang hoạt động ("Dùng số mới nhất" hoặc số khác ≥ số đó).
 * Bên cho thuê, SĐT / tuổi người đứng tên, quan hệ người ở chỉ cảnh báo. Không còn giới hạn số người ở.
 */
export function ActivateDialog({ contract: c, onClose, onDone }) {
  const toast = useToast()
  const idem = useIdempotencyKey()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [readings, setReadings] = useState(null)
  const [readingErrors, setReadingErrors] = useState({})
  const room = useQuery({ queryKey: queryKeys.rooms.detail(c.roomId), queryFn: ({ signal }) => roomsApi.get(c.roomId, { signal }) })
  const meters = useRoomMeters(c.roomId)
  const meterList = meters.data ?? []
  const currentReadings = readings ?? initialReadings(meterList, 'handover')

  const checks = [
    { ok: room.data ? !['Maintenance', 'Archived'].includes(room.data.status) : null, label: 'Phòng không bảo trì / ngừng dùng' },
    { ok: c.startDate <= addDays(todayVN(), 1), label: `Ngày bắt đầu (${formatDate(c.startDate)}) ≤ ngày mai` },
    { ok: c.occupants.some(isCurrentOccupant), label: 'Có ít nhất 1 người ở' },
  ]

  const activate = async () => {
    const clientErrors = validateReadings(meterList, currentReadings)
    setReadingErrors(clientErrors)
    if (Object.keys(clientErrors).length) return
    setBusy(true)
    setError(null)
    const body = { handoverReadings: toReadingInputs(meterList, currentReadings) }
    try {
      await contractsApi.activate(c.id, body, { idempotencyKey: idem.keyFor(body) })
      await onDone()
      toast.success('Đã kích hoạt hợp đồng — phòng chuyển "Đang thuê".')
      onClose()
    } catch (err) {
      setError(err)
      setReadingErrors(readingErrorsFromApi(err))
      if (err.code === 'METER_NOT_IN_ROOM') void meters.refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Kích hoạt / bàn giao phòng"
      description="Hệ thống chụp lại bên cho thuê, ngân hàng, phòng, người đại diện và nội quy vào hợp đồng."
      size="md"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button onClick={activate} loading={busy} disabled={meters.isPending}>
            Kích hoạt
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <CheckList checks={checks} />
        {c.warnings?.length > 0 && (
          <Alert tone="warning">
            <strong>Lưu ý (không chặn kích hoạt):</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {c.warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>{w.message ?? CONTRACT_WARNING_LABELS[w.code] ?? w.code}</li>
              ))}
            </ul>
          </Alert>
        )}
        <FormSection
          title="Chỉ số nhận phòng"
          description={`Mỗi công tơ của phòng tại ngày ${formatDate(c.billingStartDate ?? c.startDate)}. Số mới nhất thường là số cuối của người thuê trước.`}
        >
          <MeterReadingsFields query={meters} kind="handover" readings={currentReadings} onChange={setReadings} errors={readingErrors} />
        </FormSection>
        {error && (
          <Alert>
            {getErrorMessage(error)}
            {error.code === 'NO_OCCUPANT' && ' Thêm người ở ở tab “Người ở”.'}
          </Alert>
        )}
      </div>
    </Modal>
  )
}

/**
 * Sửa giá thuê (contracts.md#sửa-giá-thuê). Cách dùng chính: áp từ kỳ chưa lập phiếu đầu tiên (bỏ trống effectiveFrom) —
 * các kỳ đã lập phiếu giữ giá cũ. Hẹn trước: chọn ngày bắt đầu một kỳ thu. Không đổi giá niêm yết của phòng.
 */
export function RentTermDialog({ contract: c, onClose, onDone }) {
  const periods = useBillingPeriods(c.id)
  const today = todayVN()
  const options = (periods.data ?? [])
    .filter((p) => p.start > c.startDate && p.end >= today)
    .map((p) => ({ value: p.start, label: `${formatDate(p.start)} (${formatBillingMonth(p.billingMonth)})` }))

  return (
    <FormDialog
      title="Sửa giá thuê"
      description="Giá mới áp cả kỳ, không chia nửa kỳ. Không đổi giá niêm yết của phòng."
      initial={{ timing: 'next', effectiveFrom: '', monthlyRent: c.currentRent, addendumNo: '', note: '' }}
      validate={(v) => ({
        effectiveFrom: v.timing === 'scheduled' && !v.effectiveFrom ? 'Chọn kỳ áp dụng.' : null,
        monthlyRent: !v.monthlyRent || v.monthlyRent <= 0 ? 'Nhập giá mới.' : null,
      })}
      codeFields={{ NOT_PERIOD_START: 'effectiveFrom', PERIOD_ALREADY_BILLED: 'effectiveFrom', DATE_OUTSIDE_CONTRACT: 'effectiveFrom' }}
      submitLabel="Lưu giá mới"
      onSubmit={async (v) => {
        await contractsApi.changeRent(c.id, {
          effectiveFrom: v.timing === 'scheduled' ? v.effectiveFrom : null,
          monthlyRent: v.monthlyRent,
          addendumNo: v.addendumNo.trim() || null,
          note: v.note.trim() || null,
        })
        await onDone('Đã sửa giá thuê.')
      }}
      onClose={onClose}
    >
      {(form) => (
        <FormGrid cols={1}>
          <MoneyField label="Giá thuê mới / tháng" required {...form.field('monthlyRent', { type: 'value' })} />
          <RadioGroup
            label="Áp dụng"
            options={[
              { value: 'next', label: 'Từ kỳ chưa lập phiếu' },
              { value: 'scheduled', label: 'Hẹn từ kỳ…' },
            ]}
            value={form.values.timing}
            onChange={(t) => form.setValue('timing', t)}
          />
          {form.values.timing === 'scheduled' &&
            (periods.isPending ? (
              <Spinner />
            ) : (
              <SelectField label="Áp dụng từ kỳ" required placeholder="Chọn kỳ thu…" options={options} {...form.field('effectiveFrom')} />
            ))}
          <TextField label="Số phụ lục" maxLength={50} placeholder="PL01" {...form.field('addendumNo')} />
          <TextAreaField label="Ghi chú" rows={2} {...form.field('note')} />
        </FormGrid>
      )}
    </FormDialog>
  )
}

export function ExtendDialog({ contract: c, onClose, onDone }) {
  return (
    <FormDialog
      title="Gia hạn hợp đồng"
      description={`Ngày kết thúc hiện tại: ${formatDate(c.endDate)}. Gia hạn xóa trạng thái “ở tiếp, chưa ký lại”.`}
      initial={{ newEndDate: '' }}
      validate={(v) => ({ newEndDate: !v.newEndDate || v.newEndDate <= c.endDate ? 'Phải sau ngày kết thúc hiện tại.' : null })}
      codeFields={{ INVALID_END_DATE: 'newEndDate' }}
      submitLabel="Gia hạn"
      onSubmit={async (v) => {
        await contractsApi.extend(c.id, v)
        await onDone('Đã gia hạn hợp đồng.')
      }}
      onClose={onClose}
    >
      {(form) => <DateField label="Ngày kết thúc mới" required {...form.field('newEndDate')} />}
    </FormDialog>
  )
}

/** Hợp đồng đã quá hạn: cho ở tiếp, chưa ký lại (contracts.md#ở-tiếp-chưa-ký-lại). Vẫn tính tiền theo điều khoản cũ. */
export function HoldoverDialog({ contract: c, onClose, onDone }) {
  return (
    <FormDialog
      title="Cho ở tiếp, chưa ký lại"
      description={`Hợp đồng hết hạn ${formatDate(c.endDate)}. Vẫn tính tiền theo điều khoản cũ, kỳ thu chạy tiếp. Luật không tự gia hạn hợp đồng hết hạn — nên ký phụ lục gia hạn sớm.`}
      size="md"
      initial={{ note: '' }}
      codeFields={{ CONTRACT_NOT_EXPIRED: 'note', HOLDOVER_ALREADY: 'note' }}
      submitLabel="Ghi nhận ở tiếp"
      onSubmit={async (v) => {
        await contractsApi.holdover(c.id, { note: v.note.trim() || null })
        await onDone('Đã ghi nhận cho ở tiếp.')
      }}
      onClose={onClose}
    >
      {(form) => <TextAreaField label="Ghi chú" rows={3} maxLength={500} placeholder="VD hẹn ký lại cuối tháng" {...form.field('note')} />}
    </FormDialog>
  )
}

/**
 * Ký lại cho người còn ở (contracts.md#ký-lại-cho-người-còn-ở): HĐ cũ bắt đầu thanh lý tại ngày bàn giao, tạo HĐ nháp mới từ hôm sau
 * (chép giá, cọc, mẫu, dịch vụ, người ở còn lại, xe) → mở nháp mới để khai lại quan hệ rồi kích hoạt.
 */
export function ResignDialog({ contract: c, onClose, onDone }) {
  const navigate = useNavigate()
  const toast = useToast()
  const idem = useIdempotencyKey()
  const remaining = c.occupants.filter((o) => isCurrentOccupant(o) && o.renterId !== c.representativeRenterId)
  return (
    <FormDialog
      title="Ký lại cho người còn ở"
      description="Hợp đồng này chuyển sang thanh lý tại ngày bàn giao; hệ thống tạo hợp đồng nháp mới từ hôm sau cho người đứng tên mới."
      size="md"
      initial={{ handoverDate: todayVN(), representativeRenterId: remaining[0]?.renterId ?? '', endDate: '', transferDeposit: true }}
      validate={(v) => ({
        handoverDate: !v.handoverDate ? 'Chọn ngày bàn giao.' : null,
        representativeRenterId: !v.representativeRenterId ? 'Chọn người đứng tên mới.' : null,
        endDate: v.endDate && v.handoverDate && v.endDate <= v.handoverDate ? 'Phải sau ngày bàn giao.' : null,
      })}
      codeFields={{
        RESIGN_REPRESENTATIVE_NOT_OCCUPANT: 'representativeRenterId',
        INVALID_END_DATE: 'handoverDate',
        INVOICE_AFTER_END_DATE: 'handoverDate',
      }}
      submitLabel="Ký lại"
      onSubmit={async (v) => {
        const body = {
          handoverDate: v.handoverDate,
          representativeRenterId: v.representativeRenterId,
          endDate: v.endDate || null,
          transferDeposit: v.transferDeposit,
        }
        const result = await contractsApi.reSign(c.id, body, { idempotencyKey: idem.keyFor(body) })
        await onDone()
        toast.success('Đã tạo hợp đồng nháp mới — khai lại quan hệ người ở rồi kích hoạt.')
        for (const w of result.warnings ?? []) toast.warning(w.message ?? CONTRACT_WARNING_LABELS[w.code] ?? w.code)
        void navigate(`/contracts/${result.id}/edit`)
      }}
      onClose={onClose}
    >
      {(form) =>
        remaining.length === 0 ? (
          <Alert tone="warning">Không còn người ở nào khác người đứng tên — dùng Thanh lý thay vì ký lại.</Alert>
        ) : (
          <FormGrid>
            <DateField label="Ngày bàn giao" required hint="HĐ cũ trả phòng ngày này; HĐ mới bắt đầu hôm sau" {...form.field('handoverDate')} />
            <SelectField
              label="Người đứng tên mới"
              required
              options={remaining.map((o) => ({ value: o.renterId, label: o.fullName }))}
              {...form.field('representativeRenterId')}
            />
            <DateField label="Ngày kết thúc HĐ mới" hint="Trống = không thời hạn" {...form.field('endDate')} />
            {c.depositHeld > 0 && (
              <CheckboxField
                className="span-full"
                label={`Chuyển cọc đang giữ (${formatMoney(c.depositHeld)}) sang hợp đồng mới`}
                description="Bỏ tích: cọc ở lại hợp đồng cũ, quyết toán khi hoàn tất thanh lý hợp đồng cũ."
                {...form.field('transferDeposit', { type: 'checkbox' })}
              />
            )}
          </FormGrid>
        )
      }
    </FormDialog>
  )
}

/** Bản HĐ đã ký (giấy / ảnh / PDF) — hết cờ "Thiếu tài liệu". Không ảnh hưởng thu tiền. */
export function SignedDocumentDialog({ contract: c, onClose, onDone }) {
  return (
    <FormDialog
      title="Bản hợp đồng đã ký"
      size="md"
      initial={{ hasSignedDocument: c.hasSignedDocument ?? false, note: c.signedDocumentNote ?? '' }}
      submitLabel="Lưu"
      onSubmit={async (v) => {
        await contractsApi.setSignedDocument(c.id, { hasSignedDocument: v.hasSignedDocument, note: v.note.trim() || null })
        await onDone(v.hasSignedDocument ? 'Đã đánh dấu có bản ký.' : 'Đã bỏ đánh dấu bản ký.')
      }}
      onClose={onClose}
    >
      {(form) => (
        <>
          <CheckboxField label="Đã có bản hợp đồng ký 2 bên" description="Bản giấy, ảnh chụp hoặc PDF." {...form.field('hasSignedDocument', { type: 'checkbox' })} />
          <TextAreaField label="Nơi cất / ghi chú" rows={2} maxLength={300} placeholder="VD bản giấy ký 2 bên, cất tủ hồ sơ khu A" {...form.field('note')} />
        </>
      )}
    </FormDialog>
  )
}

export function NoticeDialog({ contract: c, onClose, onDone }) {
  const toast = useToast()
  return (
    <FormDialog
      title="Ghi nhận báo trả phòng"
      description="Chỉ ghi nhận (hợp đồng vẫn hiệu lực). Đến ngày trả phòng → Bắt đầu thanh lý. Gửi lại để sửa ngày."
      initial={{ noticeDate: c.noticeGivenDate ?? todayVN(), plannedMoveOutDate: c.plannedMoveOutDate ?? '' }}
      validate={(v) => ({
        noticeDate: !v.noticeDate ? 'Chọn ngày báo.' : null,
        plannedMoveOutDate: !v.plannedMoveOutDate ? 'Chọn ngày dự kiến trả phòng.' : v.plannedMoveOutDate < v.noticeDate ? 'Phải sau ngày báo.' : null,
      })}
      submitLabel="Ghi nhận"
      onSubmit={async (v) => {
        const result = await contractsApi.giveNotice(c.id, v)
        await onDone('Đã ghi nhận báo trả phòng.')
        if (result?.shorterThanNoticePeriod) {
          toast.warning(`Báo trước ${result.actualDays} ngày, ít hơn ${result.noticeDays} ngày theo hợp đồng — có thể mất cọc tùy thỏa thuận.`)
        }
      }}
      onClose={onClose}
    >
      {(form) => (
        <FormGrid>
          <DateField label="Ngày báo" required {...form.field('noticeDate')} />
          <DateField label="Dự kiến trả phòng" required {...form.field('plannedMoveOutDate')} />
        </FormGrid>
      )}
    </FormDialog>
  )
}

export function NoteDialog({ contract: c, onClose, onDone }) {
  return (
    <FormDialog
      title="Ghi chú nội bộ"
      size="md"
      initial={{ note: c.note ?? '' }}
      onSubmit={async (v) => {
        await contractsApi.updateNote(c.id, v.note.trim() || null)
        await onDone('Đã lưu ghi chú.')
      }}
      onClose={onClose}
    >
      {(form) => <TextAreaField label="Ghi chú" rows={6} {...form.field('note')} />}
    </FormDialog>
  )
}
