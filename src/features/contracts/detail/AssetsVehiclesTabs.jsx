import { CircleStop, ClipboardCheck, Pencil, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { contractsApi } from '@/api'
import {
  Button,
  ConfirmDialog,
  DataTable,
  DateField,
  EmptyState,
  FormDialog,
  FormGrid,
  MoneyField,
  NumberField,
  Section,
  SelectField,
  TextField,
  useToast,
} from '@/components/ui'
import { CONTRACT_WARNING_LABELS, PLATE_REQUIRED_VEHICLES, VEHICLE_TYPE_LABELS, toOptions } from '@/constants/enums'
import { formatDate, formatMoney, todayVN } from '@/lib/format'

// docs/api/contracts.md#tài-sản-bàn-giao-khi-còn-nháp — thêm/sửa/xóa khi Nháp; ghi tình trạng trả khi Đang thanh lý.
export function AssetsTab({ contract: c, actions, refresh }) {
  const toast = useToast()
  const [dialog, setDialog] = useState(null) // { type: 'form'|'return'|'delete', asset? }
  const liquidationView = c.status === 'Liquidating' || c.status === 'Ended'

  const columns = [
    { key: 'name', header: 'Tài sản', primary: true, cell: (a) => <strong>{a.name}</strong> },
    { key: 'qty', header: 'SL', cell: (a) => a.quantity },
    { key: 'handover', header: 'Tình trạng bàn giao', cell: (a) => a.conditionAtHandover ?? '—' },
    { key: 'value', header: 'Giá trị ước tính', align: 'right', cell: (a) => (a.valueEstimate ? formatMoney(a.valueEstimate) : '—') },
    ...(liquidationView
      ? [
          { key: 'return', header: 'Tình trạng khi trả', cell: (a) => a.conditionAtReturn ?? '—' },
          { key: 'comp', header: 'Bồi thường', align: 'right', cell: (a) => (a.compensationValue ? formatMoney(a.compensationValue) : '—') },
        ]
      : []),
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (a) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {actions.assetsEdit && (
            <>
              <Button size="sm" variant="ghost" iconOnly icon={Pencil} onClick={() => setDialog({ type: 'form', asset: a })}>
                Sửa
              </Button>
              <Button size="sm" variant="ghost" iconOnly icon={Trash} onClick={() => setDialog({ type: 'delete', asset: a })}>
                Xóa
              </Button>
            </>
          )}
          {actions.assetReturn && (
            <Button size="sm" variant="secondary" icon={ClipboardCheck} onClick={() => setDialog({ type: 'return', asset: a })}>
              Ghi tình trạng trả
            </Button>
          )}
        </span>
      ),
    },
  ]

  const asset = dialog?.asset
  return (
    <>
      <Section
        title="Tài sản bàn giao"
        description={c.status === 'Draft' ? 'Ghi tài sản trước khi kích hoạt; sau khi kích hoạt không sửa được.' : undefined}
        actions={
          actions.assetsEdit && (
            <Button size="sm" icon={Plus} onClick={() => setDialog({ type: 'form' })}>
              Thêm tài sản
            </Button>
          )
        }
      >
        {c.assets.length ? <DataTable columns={columns} rows={c.assets} caption="Tài sản bàn giao" /> : <EmptyState title="Chưa ghi tài sản" />}
      </Section>

      {dialog?.type === 'form' && (
        <FormDialog
          title={asset ? `Sửa ${asset.name}` : 'Thêm tài sản bàn giao'}
          initial={{
            name: asset?.name ?? '',
            quantity: asset?.quantity ?? 1,
            conditionAtHandover: asset?.conditionAtHandover ?? 'Tốt',
            valueEstimate: asset?.valueEstimate ?? null,
            note: asset?.note ?? '',
          }}
          validate={(v) => ({
            name: !v.name.trim() ? 'Nhập tên tài sản.' : null,
            quantity: !Number.isInteger(v.quantity) || v.quantity < 1 || v.quantity > 100 ? 'Từ 1 đến 100.' : null,
          })}
          onSubmit={async (v) => {
            const body = { ...v, name: v.name.trim(), conditionAtHandover: v.conditionAtHandover.trim() || null, note: v.note.trim() || null }
            if (asset) await contractsApi.updateAsset(c.id, asset.id, body)
            else await contractsApi.addAsset(c.id, body)
            await refresh()
            toast.success('Đã lưu tài sản.')
          }}
          onClose={() => setDialog(null)}
        >
          {(form) => (
            <FormGrid>
              <TextField label="Tên tài sản" required maxLength={200} className="span-full" placeholder="VD Điều hòa" {...form.field('name')} />
              <NumberField label="Số lượng" required {...form.field('quantity', { type: 'value' })} />
              <MoneyField label="Giá trị ước tính" {...form.field('valueEstimate', { type: 'value' })} />
              <TextField label="Tình trạng khi bàn giao" maxLength={500} className="span-full" {...form.field('conditionAtHandover')} />
              <TextField label="Ghi chú" maxLength={500} className="span-full" {...form.field('note')} />
            </FormGrid>
          )}
        </FormDialog>
      )}
      {dialog?.type === 'return' && (
        <FormDialog
          title={`Tình trạng khi trả — ${asset.name}`}
          initial={{ conditionAtReturn: asset.conditionAtReturn ?? '', compensationValue: asset.compensationValue ?? null }}
          onSubmit={async (v) => {
            await contractsApi.returnAsset(c.id, asset.id, { conditionAtReturn: v.conditionAtReturn.trim() || null, compensationValue: v.compensationValue })
            await refresh()
            toast.success('Đã ghi tình trạng tài sản.')
          }}
          onClose={() => setDialog(null)}
        >
          {(form) => (
            <FormGrid cols={1}>
              <TextField label="Tình trạng khi trả" maxLength={500} placeholder="VD Hỏng remote" {...form.field('conditionAtReturn')} />
              <MoneyField label="Giá trị bồi thường" {...form.field('compensationValue', { type: 'value' })} />
            </FormGrid>
          )}
        </FormDialog>
      )}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onClose={() => setDialog(null)}
        title={`Xóa tài sản "${asset?.name ?? ''}"?`}
        confirmLabel="Xóa"
        tone="danger"
        onConfirm={async () => {
          await contractsApi.deleteAsset(c.id, asset.id)
          await refresh()
        }}
      />
    </>
  )
}

// docs/api/contracts.md#xe-gửi — một biển số chỉ gửi ở một hợp đồng đang hiệu lực trong tổ chức.
export function VehiclesTab({ contract: c, actions, refresh }) {
  const toast = useToast()
  const [dialog, setDialog] = useState(null) // { type: 'add' } | { type: 'end', vehicle }
  const people = new Map([[c.representativeRenterId, c.representativeName], ...c.occupants.map((o) => [o.renterId, o.fullName])])

  const columns = [
    { key: 'plate', header: 'Biển số', primary: true, cell: (x) => <strong>{x.plateNumber ?? 'Không biển'}</strong> },
    { key: 'type', header: 'Loại', cell: (x) => VEHICLE_TYPE_LABELS[x.vehicleType] },
    { key: 'brand', header: 'Hiệu / màu', cell: (x) => x.brandColor ?? '—' },
    { key: 'owner', header: 'Chủ xe', cell: (x) => (x.renterId ? people.get(x.renterId) ?? '—' : '—') },
    { key: 'from', header: 'Gửi từ', cell: (x) => formatDate(x.registeredFrom) },
    { key: 'to', header: 'Đến', cell: (x) => (x.registeredTo ? formatDate(x.registeredTo) : 'Đang gửi') },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (x) =>
        actions.endVehicle &&
        !x.registeredTo && (
          <Button size="sm" variant="secondary" icon={CircleStop} onClick={() => setDialog({ type: 'end', vehicle: x })}>
            Kết thúc gửi
          </Button>
        ),
    },
  ]

  return (
    <>
      <Section
        title="Xe gửi"
        actions={
          actions.addVehicle && (
            <Button size="sm" icon={Plus} onClick={() => setDialog({ type: 'add' })}>
              Đăng ký xe
            </Button>
          )
        }
      >
        {c.vehicles.length ? <DataTable columns={columns} rows={c.vehicles} caption="Xe gửi" /> : <EmptyState title="Chưa đăng ký xe" />}
      </Section>

      {dialog?.type === 'add' && (
        <FormDialog
          title="Đăng ký xe"
          initial={{ renterId: '', vehicleType: 'Motorbike', plateNumber: '', brandColor: '', registeredFrom: '', note: '' }}
          validate={(v) => ({ plateNumber: PLATE_REQUIRED_VEHICLES.has(v.vehicleType) && !v.plateNumber.trim() ? 'Nhập biển số.' : null })}
          codeFields={{ PLATE_ALREADY_REGISTERED: 'plateNumber' }}
          submitLabel="Đăng ký"
          onSubmit={async (v) => {
            const result = await contractsApi.registerVehicle(c.id, {
              renterId: v.renterId || null,
              vehicleType: v.vehicleType,
              plateNumber: v.plateNumber.trim() || null,
              brandColor: v.brandColor.trim() || null,
              registeredFrom: v.registeredFrom || null,
              note: v.note.trim() || null,
            })
            await refresh()
            toast.success('Đã đăng ký xe.')
            for (const w of result?.warnings ?? []) toast.warning(w.message ?? CONTRACT_WARNING_LABELS[w.code] ?? w.code)
          }}
          onClose={() => setDialog(null)}
        >
          {(form) => (
            <FormGrid>
              <SelectField label="Loại xe" options={toOptions(VEHICLE_TYPE_LABELS)} {...form.field('vehicleType')} />
              <TextField
                label="Biển số"
                required={PLATE_REQUIRED_VEHICLES.has(form.values.vehicleType)}
                placeholder="29-B1 123.45"
                autoComplete="off"
                {...form.field('plateNumber')}
              />
              <TextField label="Hiệu / màu" placeholder="Honda Vision đỏ" {...form.field('brandColor')} />
              <SelectField
                label="Chủ xe"
                placeholder="Không ghi"
                options={[...people.entries()].map(([id, name]) => ({ value: id, label: name }))}
                {...form.field('renterId')}
              />
              <DateField label="Gửi từ ngày" hint="Trống = hôm nay (hoặc ngày bắt đầu HĐ)" {...form.field('registeredFrom')} />
              <TextField label="Ghi chú" {...form.field('note')} />
            </FormGrid>
          )}
        </FormDialog>
      )}
      {dialog?.type === 'end' && (
        <FormDialog
          title={`Kết thúc gửi xe ${dialog.vehicle.plateNumber ?? ''}`}
          initial={{ endDate: todayVN() }}
          validate={(v) => ({ endDate: !v.endDate ? 'Chọn ngày.' : v.endDate < dialog.vehicle.registeredFrom ? 'Không trước ngày bắt đầu gửi.' : null })}
          submitLabel="Kết thúc gửi"
          onSubmit={async (v) => {
            await contractsApi.endVehicle(c.id, dialog.vehicle.id, v)
            await refresh()
            toast.success('Đã kết thúc gửi xe.')
          }}
          onClose={() => setDialog(null)}
        >
          {(form) => <DateField label="Ngày kết thúc" required {...form.field('endDate')} />}
        </FormDialog>
      )}
    </>
  )
}
