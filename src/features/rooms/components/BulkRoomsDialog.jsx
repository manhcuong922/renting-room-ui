import { Plus, Sparkles, Trash } from 'lucide-react'
import { useState } from 'react'
import { queryKeys, roomsApi } from '@/api'
import { Alert, Button, FormSection, FormGrid, Modal, NumberField, TextField, useToast } from '@/components/ui'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { ROOM_CODE_PATTERN, validateRoomSpec } from '../roomForm'
import { RoomSpecFields } from './RoomSpecFields'
import styles from './BulkRoomsDialog.module.css'

const MAX_ROOMS = 500

const parseCodes = (text) =>
  text
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

const INITIAL = {
  floors: [],
  maxOccupants: null,
  areaM2: null,
  listedRent: null,
  defaultDeposit: null,
  amenities: [],
}

function validate(v) {
  const all = v.floors.flatMap((f) => parseCodes(f.codes))
  const invalid = all.filter((c) => !ROOM_CODE_PATTERN.test(c))
  const duplicates = all.filter((c, i) => all.indexOf(c) !== i)
  let floors = null
  if (all.length === 0) floors = 'Sinh danh sách phòng hoặc thêm tầng.'
  else if (all.length > MAX_ROOMS) floors = `Tối đa ${MAX_ROOMS} phòng mỗi lần (đang có ${all.length}).`
  else if (invalid.length) floors = `Mã không hợp lệ: ${[...new Set(invalid)].join(', ')}`
  else if (duplicates.length) floors = `Mã bị trùng: ${[...new Set(duplicates)].join(', ')}`
  return { floors, ...validateRoomSpec(v, '') }
}

/**
 * Tạo hàng loạt theo tầng (docs/api/rooms.md#tạo-hàng-loạt): chọn số tầng + số phòng/tầng → sinh mã {tầng}{01..n}
 * → người dùng sửa → gửi. Tất cả hoặc không: một mã trùng thì không phòng nào được tạo.
 */
export function BulkRoomsDialog({ open, onClose, propertyId }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const [generator, setGenerator] = useState({ startFloor: 1, floorCount: 3, roomsPerFloor: 5 })
  const form = useForm(INITIAL, { validate })

  const generate = () => {
    const { startFloor, floorCount, roomsPerFloor } = generator
    if (!floorCount || !roomsPerFloor) return
    const floors = Array.from({ length: floorCount }, (_, i) => {
      const floor = String((startFloor ?? 1) + i)
      const codes = Array.from({ length: roomsPerFloor }, (_, j) => `${floor}${String(j + 1).padStart(2, '0')}`)
      return { floor, codes: codes.join(', ') }
    })
    form.setValue('floors', floors)
  }

  const close = () => {
    if (form.submitting) return
    form.reset(INITIAL)
    idem.reset()
    onClose()
  }

  const submit = form.handleSubmit(async (v) => {
    const body = {
      floors: v.floors.map((f) => ({ floor: f.floor.trim() || null, codes: parseCodes(f.codes) })).filter((f) => f.codes.length),
      maxOccupants: v.maxOccupants,
      areaM2: v.areaM2,
      listedRent: v.listedRent,
      defaultDeposit: v.defaultDeposit,
      amenities: v.amenities,
    }
    const result = await roomsApi.bulkCreate(propertyId, body, { idempotencyKey: idem.keyFor(body) })
    await invalidate(queryKeys.rooms.all, queryKeys.properties.all)
    toast.success(`Đã tạo ${result.created} phòng.`)
    form.reset(INITIAL)
    idem.reset()
    onClose()
  })

  const total = form.values.floors.reduce((n, f) => n + parseCodes(f.codes).length, 0)

  return (
    <Modal
      open={open}
      onClose={close}
      title="Tạo phòng hàng loạt"
      description="Thông số áp dụng chung cho mọi phòng, sửa riêng từng phòng sau."
      size="lg"
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form="bulk-rooms-form" loading={form.submitting} disabled={total === 0}>
            Tạo {total || ''} phòng
          </Button>
        </>
      }
    >
      <form id="bulk-rooms-form" onSubmit={submit} noValidate>
        {form.formError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert>{form.formError}</Alert>
          </div>
        )}
        <FormSection title="1. Sinh danh sách phòng">
          <FormGrid cols={3}>
            <NumberField label="Từ tầng" value={generator.startFloor} onChange={(n) => setGenerator((g) => ({ ...g, startFloor: n }))} />
            <NumberField label="Số tầng" value={generator.floorCount} onChange={(n) => setGenerator((g) => ({ ...g, floorCount: Math.min(n ?? 0, 50) }))} />
            <NumberField label="Số phòng mỗi tầng" value={generator.roomsPerFloor} onChange={(n) => setGenerator((g) => ({ ...g, roomsPerFloor: Math.min(n ?? 0, 100) }))} />
          </FormGrid>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button variant="secondary" icon={Sparkles} onClick={generate}>
              Sinh mã phòng ({'{tầng}{01..n}'})
            </Button>
          </div>
        </FormSection>

        <FormSection title="2. Kiểm tra & sửa mã" description="Mỗi tầng một dòng; mã cách nhau bằng dấu phẩy hoặc khoảng trắng.">
          {form.errors.floors && <p className={styles.error}>{form.errors.floors}</p>}
          <ul className={styles.floors}>
            {form.values.floors.map((f, i) => (
              <li key={i} className={styles.floorRow}>
                <TextField label="Tầng" value={f.floor} maxLength={10} onChange={(e) => form.setValue(`floors.${i}.floor`, e.target.value)} />
                <TextField
                  label={`Mã phòng (${parseCodes(f.codes).length})`}
                  value={f.codes}
                  onChange={(e) => form.setValue(`floors.${i}.codes`, e.target.value)}
                />
                <Button
                  variant="ghost"
                  iconOnly
                  icon={Trash}
                  className={styles.remove}
                  onClick={() => form.setValue('floors', form.values.floors.filter((_, j) => j !== i))}
                >
                  Xóa tầng
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" icon={Plus} onClick={() => form.setValue('floors', [...form.values.floors, { floor: '', codes: '' }])}>
            Thêm tầng
          </Button>
        </FormSection>

        <FormSection title="3. Thông số chung">
          <RoomSpecFields form={form} prefix="" showFloor={false} showDescription={false} />
        </FormSection>
      </form>
    </Modal>
  )
}
