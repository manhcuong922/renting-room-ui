import { queryKeys, roomsApi } from '@/api'
import { Alert, Button, FormGrid, Modal, SelectField, TextField } from '@/components/ui'
import { usePropertyOptions } from '@/features/shared/queries'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { toRoomBody, toRoomForm, validateRoom } from '../roomForm'
import { RoomSpecFields } from './RoomSpecFields'

/**
 * Tạo 1 phòng (room = null) hoặc sửa phòng.
 * Tạo mới mà không truyền propertyId → hiện ô chọn khu.
 */
export function RoomFormDialog({ open, onClose, room, propertyId: fixedPropertyId, onSaved }) {
  const editing = Boolean(room)
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const properties = usePropertyOptions()
  const form = useForm(
    { ...toRoomForm(room), propertyId: fixedPropertyId ?? room?.propertyId ?? '' },
    {
      validate: (v) => ({ ...validateRoom(v), propertyId: !v.propertyId ? 'Chọn khu.' : null }),
      codeFields: { ROOM_CODE_TAKEN: 'code', MAX_OCCUPANTS_BELOW_CURRENT: 'spec.maxOccupants', PROPERTY_ARCHIVED: 'propertyId' },
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
    onClose()
  })

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
