import { useState } from 'react'
import { queryKeys, roomsApi } from '@/api'
import { Alert, Button, ConfirmDialog, FormGrid, Modal, SelectField, TextField, useToast } from '@/components/ui'
import { usePropertyOptions } from '@/features/shared/queries'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { formatMoney } from '@/lib/format'
import { toRoomBody, toRoomForm, validateRoom } from '../roomForm'
import { RoomSpecFields } from './RoomSpecFields'

/**
 * Tạo 1 phòng (room = null) hoặc sửa phòng.
 * Tạo mới mà không truyền propertyId → hiện ô chọn khu.
 * Sửa giá niêm yết khi phòng đang có người thuê → không tự đổi giá HĐ; hỏi "Áp giá mới cho người đang thuê?"
 * (POST /rooms/{id}/apply-listed-rent — áp từ kỳ chưa lập phiếu đầu tiên).
 */
export function RoomFormDialog({ open, onClose, room, propertyId: fixedPropertyId, onSaved }) {
  const editing = Boolean(room)
  const toast = useToast()
  const invalidate = useInvalidate()
  const [askApplyRent, setAskApplyRent] = useState(null) // giá niêm yết mới cần hỏi áp cho người đang thuê
  const idem = useIdempotencyKey()
  const properties = usePropertyOptions()
  const form = useForm(
    { ...toRoomForm(room), propertyId: fixedPropertyId ?? room?.propertyId ?? '' },
    {
      validate: (v) => ({ ...validateRoom(v), propertyId: !v.propertyId ? 'Chọn khu.' : null }),
      codeFields: { ROOM_CODE_TAKEN: 'code', PROPERTY_ARCHIVED: 'propertyId' },
    },
  )

  const close = () => {
    if (form.submitting) return
    idem.reset()
    onClose()
  }

  const submit = form.handleSubmit(async (v) => {
    const body = toRoomBody(v)
    let id = room?.id
    if (editing) {
      await roomsApi.update(room.id, { ...body, version: room.version })
    } else {
      ;({ id } = await roomsApi.create(v.propertyId, body, { idempotencyKey: idem.keyFor({ propertyId: v.propertyId, ...body }) }))
      idem.reset()
    }
    await invalidate(queryKeys.rooms.all, queryKeys.properties.all)
    onSaved?.(id)
    const rentChanged = editing && body.spec.listedRent !== room.listedRent
    if (rentChanged && body.spec.listedRent && room.status === 'Occupied' && room.currentContract) {
      setAskApplyRent(body.spec.listedRent)
      return
    }
    onClose()
  })

  if (askApplyRent) {
    return (
      <ConfirmDialog
        open
        onClose={onClose}
        title="Áp giá mới cho người đang thuê?"
        message={`Giá niêm yết đã đổi thành ${formatMoney(askApplyRent)}. Hợp đồng ${room.currentContract.contractNo} (${room.currentContract.representativeName}) vẫn giữ giá cũ nếu bạn không áp. Áp dụng: đổi giá thuê từ kỳ chưa lập phiếu đầu tiên — các kỳ đã lập phiếu giữ giá cũ.`}
        confirmLabel="Áp giá mới"
        onConfirm={async () => {
          await roomsApi.applyListedRent(room.id)
          await invalidate(queryKeys.rooms.all, queryKeys.contracts.all)
          toast.success('Đã áp giá mới cho hợp đồng đang thuê.')
        }}
      />
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? `Sửa phòng ${room.code}` : 'Thêm phòng'}
      size="lg"
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form="room-form" loading={form.submitting}>
            {editing ? 'Lưu' : 'Thêm phòng'}
          </Button>
        </>
      }
    >
      <form id="room-form" onSubmit={submit} noValidate style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {form.formError && <Alert>{form.formError}</Alert>}
        <FormGrid>
          {!fixedPropertyId && !editing && (
            <SelectField
              label="Khu"
              required
              placeholder="Chọn khu…"
              options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
              {...form.field('propertyId')}
            />
          )}
          <TextField label="Mã phòng" required maxLength={20} hint="Duy nhất trong khu, tự viết hoa" {...form.field('code')} />
        </FormGrid>
        <RoomSpecFields form={form} />
      </form>
    </Modal>
  )
}
