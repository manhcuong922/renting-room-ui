import { Layers, ListChecks, Pencil, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { queryKeys, roomsApi } from '@/api'
import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  ConfirmDialog,
  EmptyState,
  FormGrid,
  Modal,
  QueryView,
  Section,
  Spinner,
  TextAreaField,
  TextField,
  useToast,
} from '@/components/ui'
import { usePropertyRooms, useRoomGroups } from '@/features/shared/queries'
import { useAction, useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'

// docs/api/rooms.md#nhóm-phòng — tập phòng trong cùng khu, một phòng có thể thuộc nhiều nhóm.
export function RoomGroupsTab({ property }) {
  const groups = useRoomGroups(property.id)
  const rooms = usePropertyRooms(property.id)
  const [dialog, setDialog] = useState(null) // { type: 'form'|'members'|'delete', group? }
  const roomCode = new Map((rooms.data ?? []).map((r) => [r.id, r.code]))

  const remove = useAction({
    mutationFn: (id) => roomsApi.deleteGroup(id),
    invalidate: [queryKeys.rooms.groups(property.id)],
    success: 'Đã xóa nhóm (phòng không bị xóa).',
    toastErrors: false,
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <p style={{ color: 'var(--color-text-muted)', flex: '1 1 260px' }}>VD "Tầng 1", "Phòng có ban công". Dùng để lọc và xuất danh sách người thuê.</p>
        <Button icon={Plus} onClick={() => setDialog({ type: 'form' })}>
          Tạo nhóm
        </Button>
      </div>

      <QueryView
        query={groups}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={Layers} title="Chưa có nhóm phòng" description="Tạo nhóm để gom các phòng theo đặc điểm." />}
      >
        {(list) =>
          list.map((group) => (
            <Section
              key={group.id}
              title={group.name}
              description={group.description}
              actions={
                <>
                  <Button size="sm" variant="secondary" icon={ListChecks} onClick={() => setDialog({ type: 'members', group })}>
                    Chọn phòng
                  </Button>
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setDialog({ type: 'form', group })}>
                    Sửa
                  </Button>
                  <Button size="sm" variant="ghost" icon={Trash} onClick={() => setDialog({ type: 'delete', group })}>
                    Xóa
                  </Button>
                </>
              }
            >
              {group.roomIds.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>Chưa có phòng.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {group.roomIds.map((id) => (
                    <Badge key={id} tone="primary">
                      {roomCode.get(id) ?? '…'}
                    </Badge>
                  ))}
                </div>
              )}
            </Section>
          ))
        }
      </QueryView>

      {dialog?.type === 'form' && <GroupFormDialog propertyId={property.id} group={dialog.group} onClose={() => setDialog(null)} />}
      {dialog?.type === 'members' && (
        <GroupMembersDialog propertyId={property.id} group={dialog.group} rooms={rooms} onClose={() => setDialog(null)} />
      )}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onClose={() => setDialog(null)}
        title={`Xóa nhóm "${dialog?.group?.name ?? ''}"?`}
        message="Chỉ xóa nhóm, các phòng vẫn giữ nguyên."
        confirmLabel="Xóa nhóm"
        tone="danger"
        onConfirm={() => remove.mutateAsync(dialog.group.id)}
      />
    </>
  )
}

function GroupFormDialog({ propertyId, group, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const form = useForm(
    { name: group?.name ?? '', description: group?.description ?? '' },
    {
      validate: (v) => ({ name: !v.name.trim() ? 'Nhập tên nhóm.' : null }),
      codeFields: { ROOM_GROUP_NAME_TAKEN: 'name' },
    },
  )

  const submit = form.handleSubmit(async (v) => {
    const body = { name: v.name.trim(), description: v.description.trim() || null }
    if (group) await roomsApi.updateGroup(group.id, body)
    else await roomsApi.createGroup(propertyId, body)
    await invalidate(queryKeys.rooms.groups(propertyId))
    toast.success(group ? 'Đã lưu nhóm.' : 'Đã tạo nhóm.')
    onClose()
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={group ? 'Sửa nhóm phòng' : 'Tạo nhóm phòng'}
      size="sm"
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form="group-form" loading={form.submitting}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="group-form" onSubmit={submit} noValidate>
        <FormGrid cols={1}>
          {form.formError && <Alert>{form.formError}</Alert>}
          <TextField label="Tên nhóm" required maxLength={100} {...form.field('name')} />
          <TextAreaField label="Mô tả" rows={2} {...form.field('description')} />
        </FormGrid>
      </form>
    </Modal>
  )
}

function GroupMembersDialog({ propertyId, group, rooms, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const [selected, setSelected] = useState(() => new Set(group.roomIds))
  const [saving, setSaving] = useState(false)
  const form = useForm({})

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    setSaving(true)
    try {
      await roomsApi.setGroupMembers(group.id, { roomIds: [...selected] })
      await invalidate(queryKeys.rooms.groups(propertyId))
      toast.success('Đã cập nhật phòng trong nhóm.')
      onClose()
    } catch (error) {
      form.applyServerError(error)
    } finally {
      setSaving(false)
    }
  }

  const list = rooms.data ?? []

  return (
    <Modal
      open
      onClose={onClose}
      title={`Phòng trong nhóm "${group.name}"`}
      description={`Đã chọn ${selected.size} phòng.`}
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={save} loading={saving}>
            Lưu
          </Button>
        </>
      }
    >
      {form.formError && <Alert>{form.formError}</Alert>}
      {rooms.isPending ? (
        <Spinner />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--space-2)' }}>
          {list.map((room) => (
            <CheckboxField
              key={room.id}
              label={room.code}
              description={room.floor ? `Tầng ${room.floor}` : undefined}
              checked={selected.has(room.id)}
              onChange={() => toggle(room.id)}
            />
          ))}
        </div>
      )}
    </Modal>
  )
}
