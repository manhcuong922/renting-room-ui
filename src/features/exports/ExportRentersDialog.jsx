import { exportsApi } from '@/api'
import {
  Alert,
  Button,
  CheckboxField,
  CheckboxGroup,
  DateField,
  FormGrid,
  FormSection,
  Modal,
  RadioGroup,
  Spinner,
  useToast,
} from '@/components/ui'
import { EXPORT_LAYOUT_LABELS, toOptions } from '@/constants/enums'
import { useCanViewSensitiveData } from '@/features/auth/AuthContext'
import { usePropertyOptions, usePropertyRooms, useRoomGroups } from '@/features/shared/queries'
import { useForm } from '@/hooks/useForm'
import { saveBlob } from '@/lib/download'
import { groupByFloor } from '@/features/rooms/roomForm'

const TIME_OPTIONS = [
  { value: 'today', label: 'Đang ở hôm nay' },
  { value: 'range', label: 'Trong khoảng ngày' },
]

const defaultFileName = () => `danh-sach-nguoi-thue_${new Date().toISOString().slice(0, 10)}.xlsx`

function validate(v) {
  return {
    fromDate: v.time === 'range' && !v.fromDate ? 'Chọn ngày bắt đầu.' : null,
    toDate: v.time === 'range' && v.toDate && v.fromDate && v.toDate < v.fromDate ? 'Ngày kết thúc phải sau ngày bắt đầu.' : null,
  }
}

/**
 * Xuất danh sách người thuê ra Excel (docs/api/exports.md). Bộ lọc kết hợp AND.
 * Tầng / nhóm phòng / phòng chỉ hiện khi chọn đúng 1 khu (lấy từ dữ liệu của khu đó).
 */
export function ExportRentersDialog({ open, onClose, presetPropertyIds = [] }) {
  const toast = useToast()
  // Không có quyền dữ liệu nhạy cảm → ẩn ô "Hiện đầy đủ số giấy tờ" (gửi true sẽ bị 403 SENSITIVE_DATA_FORBIDDEN).
  const canViewSensitive = useCanViewSensitiveData()
  const properties = usePropertyOptions()
  const form = useForm(
    {
      propertyIds: presetPropertyIds,
      floors: [],
      roomGroupIds: [],
      roomIds: [],
      time: 'today',
      fromDate: '',
      toDate: '',
      layout: 'SheetPerProperty',
      includeSensitive: false,
    },
    { validate, codeFields: { INVALID_DATE_RANGE: 'toDate' } },
  )
  const singleProperty = form.values.propertyIds.length === 1 ? form.values.propertyIds[0] : null
  const rooms = usePropertyRooms(singleProperty)
  const groups = useRoomGroups(singleProperty)

  const submit = form.handleSubmit(async (v) => {
    const body = {
      propertyIds: v.propertyIds,
      floors: singleProperty ? v.floors : [],
      roomGroupIds: singleProperty ? v.roomGroupIds : [],
      roomIds: singleProperty ? v.roomIds : [],
      fromDate: v.time === 'range' ? v.fromDate : null,
      toDate: v.time === 'range' ? v.toDate || v.fromDate : null,
      layout: v.layout,
      includeSensitive: canViewSensitive && v.includeSensitive,
    }
    const { blob, filename } = await exportsApi.renters(body)
    saveBlob(blob, filename ?? defaultFileName())
    toast.success('Đã xuất file Excel.')
    onClose()
  })

  // Đổi khu → bỏ lựa chọn tầng/nhóm/phòng cũ.
  const setProperties = (ids) => {
    form.setValue('propertyIds', ids)
    form.setValue('floors', [])
    form.setValue('roomGroupIds', [])
    form.setValue('roomIds', [])
  }

  const floors = groupByFloor(rooms.data ?? [])
    .map(([floor]) => floor)
    .filter(Boolean)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xuất danh sách người thuê"
      description="File .xlsx — mỗi dòng là một người ở trong một hợp đồng đã bàn giao."
      size="lg"
      dismissible={!form.submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" form="export-renters-form" loading={form.submitting}>
            Xuất Excel
          </Button>
        </>
      }
    >
      <form id="export-renters-form" onSubmit={submit} noValidate>
        {form.formError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert>{form.formError}</Alert>
          </div>
        )}
        <FormSection title="Phạm vi" description="Để trống = tất cả khu.">
          {properties.isPending ? (
            <Spinner />
          ) : (
            <CheckboxGroup
              label="Khu trọ"
              options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
              value={form.values.propertyIds}
              onChange={setProperties}
            />
          )}
          {singleProperty && (
            <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              {floors.length > 0 && (
                <CheckboxGroup
                  label="Tầng"
                  options={floors.map((f) => ({ value: f, label: `Tầng ${f}` }))}
                  value={form.values.floors}
                  onChange={(v) => form.setValue('floors', v)}
                />
              )}
              {(groups.data ?? []).length > 0 && (
                <CheckboxGroup
                  label="Nhóm phòng"
                  options={groups.data.map((g) => ({ value: g.id, label: g.name }))}
                  value={form.values.roomGroupIds}
                  onChange={(v) => form.setValue('roomGroupIds', v)}
                />
              )}
              {(rooms.data ?? []).length > 0 && (
                <CheckboxGroup
                  label="Phòng"
                  options={rooms.data.map((r) => ({ value: r.id, label: r.code }))}
                  value={form.values.roomIds}
                  onChange={(v) => form.setValue('roomIds', v)}
                />
              )}
            </div>
          )}
        </FormSection>

        <FormSection title="Thời điểm">
          <FormGrid>
            <RadioGroup className="span-full" options={TIME_OPTIONS} value={form.values.time} onChange={(v) => form.setValue('time', v)} />
            {form.values.time === 'range' && (
              <>
                <DateField label="Từ ngày" required {...form.field('fromDate')} />
                <DateField label="Đến ngày" hint="Trống = chỉ ngày bắt đầu" {...form.field('toDate')} />
              </>
            )}
          </FormGrid>
        </FormSection>

        <FormSection title="Trình bày">
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <RadioGroup label="Chia sheet" options={toOptions(EXPORT_LAYOUT_LABELS)} value={form.values.layout} onChange={(v) => form.setValue('layout', v)} />
            {canViewSensitive && (
              <CheckboxField
                label="Hiện đầy đủ số giấy tờ"
                description="Dữ liệu cá nhân — thao tác được ghi log kiểm toán. Mặc định số giấy tờ bị che."
                {...form.field('includeSensitive', { type: 'checkbox' })}
              />
            )}
            {canViewSensitive && form.values.includeSensitive && (
              <Alert tone="warning">File chứa số giấy tờ đầy đủ. Chỉ gửi cho cơ quan có thẩm quyền, không chia sẻ công khai.</Alert>
            )}
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Giới hạn 5 lần xuất / phút mỗi tài khoản.</p>
          </div>
        </FormSection>
      </form>
    </Modal>
  )
}
