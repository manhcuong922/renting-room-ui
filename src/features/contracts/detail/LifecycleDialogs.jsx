import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { contractsApi, propertiesApi, queryKeys, roomsApi } from '@/api'
import {
  Alert,
  Button,
  CheckboxField,
  DateField,
  FormDialog,
  FormGrid,
  Modal,
  MoneyField,
  SelectField,
  Spinner,
  TextAreaField,
  TextField,
  useToast,
} from '@/components/ui'
import { TERMINATION_GROUND_LABELS, TERMINATION_REASON_LABELS, toOptions } from '@/constants/enums'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { getErrorMessage } from '@/lib/http/ApiError'
import { addDays, formatBillingMonth, formatDate, todayVN } from '@/lib/format'
import { useBillingPeriods } from '../hooks'

// Link gợi ý theo mã lỗi kích hoạt (docs/api/contracts.md#kích-hoạt-bàn-giao-phòng).
function activationHint(error, c) {
  if (error.code === 'LESSOR_INFO_INCOMPLETE') return <Link to={`/properties/${c.propertyId}?tab=lessor`}>Khai báo bên cho thuê</Link>
  if (error.code === 'REPRESENTATIVE_PHONE_REQUIRED') return <Link to={`/renters/${c.representativeRenterId}`}>Sửa hồ sơ người đại diện</Link>
  if (error.code === 'NO_OCCUPANT') return 'Thêm người ở ở tab "Người ở".'
  return null
}

/** Kích hoạt (bàn giao phòng): checklist + xác nhận vượt sức chứa (overrideCapacity, có ghi log). */
export function ActivateDialog({ contract: c, onClose, onDone }) {
  const toast = useToast()
  const idem = useIdempotencyKey()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [override, setOverride] = useState(false)
  const room = useQuery({ queryKey: queryKeys.rooms.detail(c.roomId), queryFn: ({ signal }) => roomsApi.get(c.roomId, { signal }) })
  const property = useQuery({ queryKey: queryKeys.properties.detail(c.propertyId), queryFn: ({ signal }) => propertiesApi.get(c.propertyId, { signal }) })

  const current = c.occupants.filter((o) => !o.moveOutDate)
  const checks = [
    { ok: room.data ? !['Maintenance', 'Archived'].includes(room.data.status) : null, label: 'Phòng không bảo trì / ngừng dùng' },
    { ok: c.startDate <= addDays(todayVN(), 1), label: `Ngày bắt đầu (${formatDate(c.startDate)}) ≤ ngày mai` },
    { ok: property.data ? Boolean(property.data.lessor?.isComplete) : null, label: 'Khu đã khai báo đủ bên cho thuê' },
    { ok: current.length > 0, label: 'Có ít nhất 1 người ở' },
    { ok: room.data ? current.length <= room.data.maxOccupants : null, label: `Số người ở ≤ sức chứa${room.data ? ` (${current.length}/${room.data.maxOccupants})` : ''}` },
  ]

  const activate = async () => {
    setBusy(true)
    setError(null)
    const body = override ? { overrideCapacity: true } : undefined
    try {
      await contractsApi.activate(c.id, body, { idempotencyKey: idem.keyFor(body ?? {}) })
      await onDone()
      toast.success('Đã kích hoạt hợp đồng — phòng chuyển "Đang thuê".')
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Kích hoạt / bàn giao phòng"
      description="Khi kích hoạt, hệ thống chụp lại bên cho thuê, ngân hàng, phòng, người đại diện và nội quy vào hợp đồng."
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button onClick={activate} loading={busy}>
            Kích hoạt
          </Button>
        </>
      }
    >
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
      {error && (
        <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <Alert>
            {getErrorMessage(error)} {activationHint(error, c)}
          </Alert>
          {error.code === 'ROOM_CAPACITY_EXCEEDED' && (
            <CheckboxField
              label="Tôi xác nhận vượt sức chứa phòng"
              description="VD gia đình có con nhỏ ở phòng 2 người — thao tác được ghi log kiểm toán."
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
            />
          )}
        </div>
      )}
    </Modal>
  )
}

export function RentTermDialog({ contract: c, onClose, onDone }) {
  const periods = useBillingPeriods(c.id)
  // effectiveFrom phải là ngày bắt đầu một kỳ thu sau ngày bắt đầu HĐ (NOT_PERIOD_START) → chỉ cho chọn từ danh sách.
  const used = new Set(c.rentTerms.map((t) => t.effectiveFrom))
  const options = (periods.data ?? [])
    .filter((p) => p.start > c.startDate && !used.has(p.start))
    .map((p) => ({ value: p.start, label: `${formatDate(p.start)} (${formatBillingMonth(p.billingMonth)})` }))

  return (
    <FormDialog
      title="Phụ lục đổi giá"
      description="Giá mới áp dụng từ đầu một kỳ thu. Không đổi giá niêm yết của phòng."
      initial={{ effectiveFrom: '', monthlyRent: c.currentRent, addendumNo: '', note: '' }}
      validate={(v) => ({
        effectiveFrom: !v.effectiveFrom ? 'Chọn kỳ áp dụng.' : null,
        monthlyRent: !v.monthlyRent || v.monthlyRent <= 0 ? 'Nhập giá mới.' : null,
      })}
      codeFields={{ NOT_PERIOD_START: 'effectiveFrom', RENT_TERM_EXISTS: 'effectiveFrom', PERIOD_ALREADY_BILLED: 'effectiveFrom' }}
      submitLabel="Lưu phụ lục"
      onSubmit={async (v) => {
        await contractsApi.changeRent(c.id, { ...v, addendumNo: v.addendumNo.trim() || null, note: v.note.trim() || null })
        await onDone('Đã thêm phụ lục đổi giá.')
      }}
      onClose={onClose}
    >
      {(form) => (
        <FormGrid cols={1}>
          {periods.isPending ? (
            <Spinner />
          ) : (
            <SelectField label="Áp dụng từ kỳ" required placeholder="Chọn kỳ thu…" options={options} {...form.field('effectiveFrom')} />
          )}
          <MoneyField label="Giá thuê mới / tháng" required {...form.field('monthlyRent', { type: 'value' })} />
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
      description={`Ngày kết thúc hiện tại: ${formatDate(c.endDate)}.`}
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

export function StartLiquidationDialog({ contract: c, onClose, onDone }) {
  return (
    <FormDialog
      title="Bắt đầu thanh lý"
      description="Chốt ngày trả phòng → ghi tình trạng tài sản → hoàn tất từ ngày trả phòng."
      size="md"
      initial={{ actualEndDate: c.plannedMoveOutDate ?? todayVN(), reason: c.endDate && c.endDate <= todayVN() ? 'Expired' : 'LesseeUnilateral', ground: '', note: '' }}
      validate={(v) => ({
        actualEndDate: !v.actualEndDate ? 'Chọn ngày trả phòng.' : v.actualEndDate < c.startDate ? 'Không trước ngày bắt đầu.' : v.actualEndDate > addDays(todayVN(), 60) ? 'Tối đa 60 ngày tới.' : null,
        ground: v.reason === 'LessorUnilateral' && !v.ground ? 'Chọn căn cứ chấm dứt.' : null,
        note: v.ground === 'Other' && !v.note.trim() ? 'Ghi rõ căn cứ.' : null,
      })}
      codeFields={{ TERMINATION_GROUND_REQUIRED: 'ground' }}
      submitLabel="Bắt đầu thanh lý"
      onSubmit={async (v) => {
        await contractsApi.startLiquidation(c.id, {
          actualEndDate: v.actualEndDate,
          reason: v.reason,
          ground: v.reason === 'LessorUnilateral' ? v.ground : null,
          note: v.note.trim() || null,
        })
        await onDone('Đã chuyển sang thanh lý.')
      }}
      onClose={onClose}
    >
      {(form) => (
        <FormGrid>
          <DateField label="Ngày trả phòng thực tế" required {...form.field('actualEndDate')} />
          <SelectField label="Lý do chấm dứt" options={toOptions(TERMINATION_REASON_LABELS)} {...form.field('reason')} />
          {form.values.reason === 'LessorUnilateral' && (
            <SelectField
              label="Căn cứ (Luật Nhà ở 2023, Điều 172)"
              required
              placeholder="Chọn…"
              className="span-full"
              options={toOptions(TERMINATION_GROUND_LABELS)}
              {...form.field('ground')}
            />
          )}
          <TextAreaField label="Ghi chú" rows={2} maxLength={1000} className="span-full" required={form.values.ground === 'Other'} {...form.field('note')} />
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
