import { useState } from 'react'
import { contractsApi } from '@/api'
import { Alert, Button, CheckboxField, FormGrid, FormSection, Modal, MoneyField, SelectField, TextField, useToast } from '@/components/ui'
import { usePropertyRooms, useRoomMeters } from '@/features/shared/queries'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { formatDate, formatMoney, todayVN } from '@/lib/format'
import { getErrorMessage } from '@/lib/http/ApiError'
import { MeterReadingsFields } from './MeterReadingsFields'
import { initialReadings, readingErrorsFromApi, toReadingInputs, validateReadings } from './meterReadings'

const RENT_FROM_OPTIONS = [
  { value: 'CurrentPeriod', label: 'Cả kỳ này' },
  { value: 'NextPeriod', label: 'Từ kỳ sau' },
]
// Mã lỗi → ô hiển thị (contracts.md#chuyển-phòng).
const FIELD_OF = {
  ROOM_TRANSFER_SAME_ROOM: 'toRoomId',
  ROOM_TRANSFER_OTHER_PROPERTY: 'toRoomId',
  ROOM_TRANSFER_ROOM_UNAVAILABLE: 'toRoomId',
  ROOM_NOT_FOUND: 'toRoomId',
  MONTHLY_RENT_REQUIRED: 'monthlyRent',
}

/**
 * Chuyển phòng trong cùng khu (CT-UC-12): hợp đồng đi theo người thuê — giữ số hợp đồng, người ở, xe, dịch vụ, cọc; chỉ đổi phòng, luôn từ hôm nay
 * (không chọn ngày — đổi 17/10/2026). Bắt buộc chỉ số cuối mọi công tơ phòng cũ hôm nay: sản lượng phòng cũ cộng vào dòng điện nước của phiếu kỳ này.
 */
export function TransferRoomDialog({ contract: c, onClose, onDone }) {
  const toast = useToast()
  const idem = useIdempotencyKey()
  const since = c.roomSince ?? c.startDate
  const [values, setValues] = useState({ toRoomId: '', monthlyRent: null, rentFrom: '', removeFeeTypeIds: [], note: '' })
  const [errors, setErrors] = useState({})
  const [oldReadings, setOldReadings] = useState(null)
  const [newReadings, setNewReadings] = useState(null)
  const [oldErrors, setOldErrors] = useState({})
  const [newErrors, setNewErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const rooms = usePropertyRooms(c.propertyId, { status: 'Vacant' })
  const targets = (rooms.data ?? []).filter((r) => r.id !== c.roomId)
  const target = targets.find((r) => r.id === values.toRoomId)
  const oldMeters = useRoomMeters(c.roomId)
  const newMeters = useRoomMeters(values.toRoomId, { enabled: Boolean(values.toRoomId) })
  const oldList = oldMeters.data ?? []
  const newList = newMeters.data ?? []
  // Phòng cũ: luôn phải nhập số cuối tại ngày chuyển (không có lựa chọn "giữ số cũ").
  const currentOld = oldReadings ?? Object.fromEntries(oldList.map((m) => [m.id, { mode: 'custom', value: null }]))
  const currentNew = newReadings ?? initialReadings(newList, 'handover')
  const services = (c.fees ?? []).filter((f) => !f.effectiveTo)
  const set = (changes) => {
    setValues((v) => ({ ...v, ...changes }))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([key]) => !(key in changes))))
  }

  const submit = async () => {
    const clientErrors = {
      toRoomId: !values.toRoomId ? 'Chọn phòng mới.' : null,
      monthlyRent: values.monthlyRent !== null && values.monthlyRent <= 0 ? 'Giá thuê lớn hơn 0.' : null,
    }
    const oldClient = Object.fromEntries(oldList.filter((m) => currentOld[m.id]?.value === null || currentOld[m.id]?.value === undefined).map((m) => [m.id, 'Nhập chỉ số cuối hôm nay.']))
    for (const m of oldList) {
      const value = currentOld[m.id]?.value
      if (value !== null && value !== undefined && m.latestReading && value < m.latestReading.value) oldClient[m.id] = `Phải ≥ chỉ số mới nhất (${m.latestReading.value}).`
    }
    const newClient = validateReadings(newList, currentNew)
    setErrors(clientErrors)
    setOldErrors(oldClient)
    setNewErrors(newClient)
    if (Object.values(clientErrors).some(Boolean) || Object.keys(oldClient).length || Object.keys(newClient).length) return toast.error('Vui lòng kiểm tra các ô được đánh dấu.')

    const body = {
      toRoomId: values.toRoomId,
      oldRoomReadings: oldList.map((m) => ({ meterId: m.id, value: currentOld[m.id].value })),
      newRoomReadings: newList.length ? toReadingInputs(newList, currentNew) : null,
      monthlyRent: values.monthlyRent,
      rentFrom: values.rentFrom || null,
      removeFeeTypeIds: values.removeFeeTypeIds,
      note: values.note.trim() || null,
    }
    setBusy(true)
    try {
      const result = await contractsApi.transferRoom(c.id, body, { idempotencyKey: idem.keyFor(body) })
      idem.reset()
      await onDone(`Đã chuyển hợp đồng sang phòng ${target?.code ?? ''}.`)
      // Cảnh báo không chặn: giá niêm yết được áp, khác nhau về công tơ giữa hai phòng, nhắc đổi nơi cư trú…
      result?.warnings?.forEach((w) => toast.warning(w.message, { duration: 12_000 }))
      onClose()
    } catch (error) {
      // Lỗi chỉ số: gắn vào đúng công tơ của phòng cũ / phòng mới.
      const byMeter = readingErrorsFromApi(error)
      const oldIds = new Set(oldList.map((m) => m.id))
      setOldErrors(Object.fromEntries(Object.entries(byMeter).filter(([id]) => oldIds.has(id))))
      setNewErrors(Object.fromEntries(Object.entries(byMeter).filter(([id]) => !oldIds.has(id))))
      if (FIELD_OF[error.code]) setErrors({ [FIELD_OF[error.code]]: error.detail ?? getErrorMessage(error) })
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Chuyển phòng — hợp đồng ${c.contractNo}`}
      description={`Đang ở phòng ${c.roomCode} từ ${formatDate(since)}. Chỉ chuyển được sang phòng trống cùng khu; khác khu thì thanh lý rồi lập hợp đồng mới.`}
      size="lg"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button onClick={submit} loading={busy} disabled={oldMeters.isPending}>
            Chuyển phòng
          </Button>
        </>
      }
    >
      <FormSection title="Phòng mới" description={`Chuyển từ hôm nay ${formatDate(todayVN())} — hôm nay tính là còn ở cả hai phòng; phòng cũ trống từ ngày mai.`}>
        <FormGrid>
          <SelectField
            label="Chuyển sang phòng"
            required
            placeholder={rooms.isPending ? 'Đang tải…' : targets.length ? 'Chọn phòng trống…' : 'Khu không còn phòng trống'}
            options={targets.map((r) => ({ value: r.id, label: `${r.code}${r.floor ? ` · tầng ${r.floor}` : ''}${r.listedRent ? ` · ${formatMoney(r.listedRent)}` : ''}` }))}
            error={errors.toRoomId}
            value={values.toRoomId}
            onChange={(e) => {
              set({ toRoomId: e.target.value })
              setNewReadings(null)
              setNewErrors({})
            }}
          />
        </FormGrid>
      </FormSection>

      <FormSection title={`Chỉ số cuối phòng ${c.roomCode} hôm nay`} description="Sản lượng phòng cũ tới chỉ số này được cộng vào dòng điện nước của phiếu kỳ này (cùng dòng với phòng mới).">
        <MeterReadingsFields query={oldMeters} kind="final" readings={currentOld} onChange={setOldReadings} errors={oldErrors} />
      </FormSection>

      {values.toRoomId && (
        <FormSection title={`Chỉ số nhận phòng ${target?.code ?? ''}`}>
          <MeterReadingsFields query={newMeters} kind="handover" readings={currentNew} onChange={setNewReadings} errors={newErrors} />
        </FormSection>
      )}

      <FormSection title="Giá thuê và dịch vụ">
        <FormGrid>
          <MoneyField
            label="Giá thuê sau khi chuyển"
            hint={`Bỏ trống = giá niêm yết phòng mới${target?.listedRent ? ` (${formatMoney(target.listedRent)})` : ''}. Giữ giá cũ thì nhập ${formatMoney(c.currentRent)}`}
            error={errors.monthlyRent}
            value={values.monthlyRent}
            onChange={(monthlyRent) => set({ monthlyRent })}
          />
          <SelectField
            label="Giá mới áp cho"
            placeholder="Tự chọn theo số ngày đã ở phòng cũ trong kỳ"
            hint="Giá áp cho cả kỳ, không chia ngày theo từng phòng"
            options={RENT_FROM_OPTIONS}
            value={values.rentFrom}
            onChange={(e) => set({ rentFrom: e.target.value })}
          />
          <TextField label="Ghi chú" className="span-full" value={values.note} onChange={(e) => set({ note: e.target.value })} />
        </FormGrid>
        {services.length > 0 && (
          <div style={{ display: 'grid', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
            <strong style={{ fontSize: 'var(--text-sm)' }}>Dịch vụ không dùng ở phòng mới (thôi tính từ kỳ chưa lập phiếu đầu tiên)</strong>
            {services.map((f) => (
              <CheckboxField
                key={f.feeTypeId}
                label={`Bỏ ${f.name}`}
                checked={values.removeFeeTypeIds.includes(f.feeTypeId)}
                onChange={(e) => set({ removeFeeTypeIds: e.target.checked ? [...values.removeFeeTypeIds, f.feeTypeId] : values.removeFeeTypeIds.filter((id) => id !== f.feeTypeId) })}
              />
            ))}
          </div>
        )}
      </FormSection>
      <Alert tone="info">Chuyển nhầm: ngay trong hôm nay bấm “Chuyển lại về phòng {c.roomCode}” ở trang hợp đồng — hoàn lại như chưa chuyển. Từ ngày mai, quay về là một lần chuyển phòng mới.</Alert>
    </Modal>
  )
}
