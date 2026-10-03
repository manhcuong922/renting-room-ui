import { FileStack, Plus, Trash } from 'lucide-react'
import { Link } from 'react-router'
import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  CheckboxGroup,
  DateField,
  DescriptionList,
  EmptyState,
  FormGrid,
  FormSection,
  MoneyField,
  NumberField,
  RadioGroup,
  SelectField,
  Spinner,
  TextAreaField,
  TextField,
} from '@/components/ui'
import {
  CHARGE_MODE_LABELS,
  CONTRACT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PRORATION_MODE_LABELS,
  RELATIONSHIP_LABELS,
  ROOM_STATUS,
  toOptions,
} from '@/constants/enums'
import { usePropertyOptions, usePropertyRooms } from '@/features/shared/queries'
import { cx } from '@/lib/cx'
import { formatDate, formatMoney } from '@/lib/format'
import { CustomFieldInput } from '../components/CustomFieldInput'
import { buildOccupants } from '../contractForm'
import styles from './Wizard.module.css'

/** Bước 0 — chọn mẫu (quyết định tiêu đề, điều khoản, trường tùy biến) hoặc "Không dùng mẫu" + loại. */
export function TemplateStep({ form, templates, onSelectTemplate }) {
  const v = form.values
  const list = (templates.data ?? []).filter((t) => !t.isArchived || t.id === v.templateId)
  if (templates.isPending) return <Spinner />
  return (
    <>
      <ul className={styles.choices}>
        {list.map((t) => (
          <li key={t.id}>
            <button type="button" className={cx(styles.choice, v.templateId === t.id && styles.choiceActive)} onClick={() => onSelectTemplate(t)}>
              <strong>{t.name}</strong>
              <span className={styles.muted}>
                {CONTRACT_TYPE_LABELS[t.contractType]} · {t.clauses.length} điều khoản · {t.fields.length} trường
              </span>
              <span className={styles.badges}>
                {t.noDeposit && <Badge tone="warning">Không cọc</Badge>}
                {t.isArchived && <Badge>Ngừng dùng</Badge>}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={cx(styles.choice, !v.templateId && styles.choiceActive)} onClick={() => onSelectTemplate(null)}>
            <strong>Không dùng mẫu</strong>
            <span className={styles.muted}>Tự nhập điều khoản bổ sung, không có trường tùy biến.</span>
          </button>
        </li>
      </ul>
      {list.length === 0 && (
        <p className={styles.muted} style={{ marginTop: 'var(--space-3)' }}>
          <FileStack size={14} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> Chưa có mẫu nào.{' '}
          <Link to="/contract-templates">Tạo mẫu hợp đồng</Link>
        </p>
      )}
      {!v.templateId && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <RadioGroup label="Loại hợp đồng" options={toOptions(CONTRACT_TYPE_LABELS)} value={v.contractType} onChange={(t) => form.setValue('contractType', t)} />
        </div>
      )}
    </>
  )
}

/** Bước 1 — chọn khu → phòng (Trống / Giữ chỗ; Bảo trì vẫn tạo nháp được nhưng chưa kích hoạt được). */
export function RoomStep({ form, onSelectRoom, locked }) {
  const v = form.values
  const properties = usePropertyOptions()
  const rooms = usePropertyRooms(v.propertyId)
  const selectable = (rooms.data ?? []).filter((r) => ['Vacant', 'Reserved', 'Maintenance'].includes(r.status))

  if (locked) {
    return <Alert tone="info">Không đổi được phòng của hợp đồng nháp. Muốn đổi phòng: hủy nháp và tạo hợp đồng mới.</Alert>
  }

  return (
    <>
      <FormGrid>
        <SelectField
          label="Khu"
          placeholder="Chọn khu…"
          options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
          value={v.propertyId}
          onChange={(e) => {
            form.setValue('propertyId', e.target.value)
            form.setValue('roomId', '')
          }}
        />
      </FormGrid>
      {form.errors.roomId && <p className={styles.error}>{form.errors.roomId}</p>}
      {v.propertyId && rooms.isPending && <Spinner />}
      {v.propertyId && !rooms.isPending && selectable.length === 0 && <EmptyState title="Khu không có phòng trống / giữ chỗ" />}
      <ul className={styles.roomChoices}>
        {selectable.map((r) => (
          <li key={r.id}>
            <button type="button" className={cx(styles.choice, v.roomId === r.id && styles.choiceActive)} onClick={() => onSelectRoom(r)}>
              <strong>Phòng {r.code}</strong>
              <span className={styles.muted}>
                {r.floor ? `Tầng ${r.floor} · ` : ''}
                {r.maxOccupants} người · {r.listedRent ? formatMoney(r.listedRent) : 'chưa có giá'}
              </span>
              <span className={styles.badges}>
                <Badge tone={ROOM_STATUS[r.status].tone}>{ROOM_STATUS[r.status].label}</Badge>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Bước 3 — thời hạn, giá, cọc, cài đặt thu (gợi ý từ phòng & khu). */
export function TermsStep({ form, template, room, creating }) {
  const v = form.values
  return (
    <>
      <FormSection title="Thời hạn">
        <FormGrid cols={3}>
          <DateField label="Ngày bắt đầu" required hint="Cho phép nhập lại HĐ cũ tới 1 năm trước" {...form.field('startDate')} />
          <DateField label="Ngày kết thúc" required={!v.indefinite} disabled={v.indefinite} {...form.field('endDate')} />
          <CheckboxField label="Không thời hạn" {...form.field('indefinite', { type: 'checkbox' })} />
          <DateField label="Ngày ký" hint="Trống = tự xác định khi kích hoạt" {...form.field('signedDate')} />
          <TextField label="Nơi ký" maxLength={200} {...form.field('signedPlace')} />
          <DateField label="Ngày hiệu lực" hint="Trống = ngày ký" {...form.field('effectiveDate')} />
          {creating && <TextField label="Số hợp đồng" maxLength={30} hint="Trống = tự sinh HD{năm}-{0001}" {...form.field('contractNo')} />}
        </FormGrid>
      </FormSection>

      <FormSection title="Tiền thuê & cọc">
        <FormGrid cols={3}>
          <MoneyField
            label="Giá thuê / tháng"
            required={!room?.listedRent}
            hint={room?.listedRent ? `Niêm yết ${formatMoney(room.listedRent)}` : undefined}
            {...form.field('monthlyRent', { type: 'value' })}
          />
          {template?.noDeposit ? (
            <TextField label="Tiền cọc" value="Không cọc (theo mẫu)" disabled />
          ) : (
            <MoneyField label="Tiền cọc" hint="0 = không cọc; tối đa 12 tháng tiền thuê" {...form.field('depositAmount', { type: 'value' })} />
          )}
          <NumberField label="Số bản hợp đồng" {...form.field('copiesCount', { type: 'value' })} />
          {!template?.noDeposit && <TextAreaField label="Điều kiện hoàn cọc" rows={2} maxLength={5000} className="span-full" {...form.field('depositTerms')} />}
          <CheckboxGroup
            label="Phương thức thanh toán"
            className="span-full"
            options={toOptions(PAYMENT_METHOD_LABELS)}
            value={v.paymentMethods}
            onChange={(m) => form.setValue('paymentMethods', m)}
            error={form.errors.paymentMethods}
          />
        </FormGrid>
      </FormSection>

      <FormSection title="Cài đặt thu" description="Gợi ý từ cài đặt của khu — chỉnh riêng cho hợp đồng này nếu cần.">
        <FormGrid cols={3}>
          <NumberField label="Ngày chốt kỳ thu" {...form.field('billing.anchorDay', { type: 'value' })} />
          <SelectField label="Thu tiền phòng" options={toOptions(CHARGE_MODE_LABELS)} {...form.field('billing.chargeMode')} />
          <NumberField label="Hạn đóng sau ngày chốt" suffix="ngày" {...form.field('billing.paymentDueDays', { type: 'value' })} />
          <SelectField label="Tháng lẻ" options={toOptions(PRORATION_MODE_LABELS)} {...form.field('billing.prorationMode')} />
          <NumberField label="Báo trước khi trả phòng" suffix="ngày" {...form.field('noticeDays', { type: 'value' })} />
        </FormGrid>
      </FormSection>

      <FormSection title="Ghi chú nội bộ">
        <TextAreaField label="Ghi chú" rows={2} {...form.field('note')} />
      </FormSection>
    </>
  )
}

/** Bước 4 — form sinh từ `fields` của mẫu + tiêu đề / điều khoản (ghi đè cho riêng hợp đồng này). */
export function DocumentStep({ form, template }) {
  const v = form.values
  const toggleOverride = (checked) => {
    form.setValue('overrideClauses', checked)
    if (checked && v.clauses.length === 0) form.setValue('clauses', (template?.clauses ?? []).map((c) => ({ heading: c.heading, body: c.body })))
  }
  return (
    <>
      {template?.fields?.length > 0 && (
        <FormSection title="Thông tin theo mẫu" description={`Trường của mẫu “${template.name}”.`}>
          <FormGrid>
            {template.fields.map((f) => (
              <CustomFieldInput
                key={f.key}
                field={f}
                value={v.customFields[f.key]}
                onChange={(value) => form.setValue(`customFields.${f.key}`, value)}
                error={form.errors[`customFields.${f.key}`]}
              />
            ))}
          </FormGrid>
        </FormSection>
      )}

      <FormSection title="Văn bản hợp đồng">
        <FormGrid cols={1}>
          <TextField label="Tiêu đề" maxLength={200} placeholder={template?.title ?? 'Theo loại hợp đồng'} hint="Trống = theo mẫu / loại hợp đồng" {...form.field('title')} />
          {template && (
            <CheckboxField
              label="Tùy chỉnh điều khoản cho riêng hợp đồng này"
              description="Bỏ tích = dùng điều khoản của mẫu."
              checked={v.overrideClauses}
              onChange={(e) => toggleOverride(e.target.checked)}
            />
          )}
        </FormGrid>
        {(v.overrideClauses || !template) && (
          <div className={styles.clauses}>
            {v.clauses.map((_, i) => (
              <div key={i} className={styles.clause}>
                <div className={styles.clauseHead}>
                  <strong>Điều {i + 1}</strong>
                  <Button variant="ghost" size="sm" iconOnly icon={Trash} onClick={() => form.setValue('clauses', v.clauses.filter((__, j) => j !== i))}>
                    Xóa điều khoản
                  </Button>
                </div>
                <FormGrid cols={1}>
                  <TextField label="Tiêu đề" maxLength={200} {...form.field(`clauses.${i}.heading`)} />
                  <TextAreaField label="Nội dung" rows={4} maxLength={10_000} {...form.field(`clauses.${i}.body`)} />
                </FormGrid>
              </div>
            ))}
            <Button
              variant="secondary"
              icon={Plus}
              disabled={v.clauses.length >= 30}
              onClick={() => {
                if (!template) form.setValue('overrideClauses', true)
                form.setValue('clauses', [...v.clauses, { heading: '', body: '' }])
              }}
            >
              Thêm điều khoản
            </Button>
          </div>
        )}
        <div style={{ marginTop: 'var(--space-4)' }}>
          <TextAreaField label="Điều khoản bổ sung" rows={4} maxLength={50_000} {...form.field('termsText')} />
        </div>
      </FormSection>
    </>
  )
}

/** Bước 5 — xem lại + cảnh báo trước khi lưu nháp (checklist kích hoạt). */
export function ReviewStep({ form, template, room, property }) {
  const v = form.values
  const occupants = buildOccupants(v)
  const warnings = [
    occupants.length === 0 && 'Chưa có người ở — kích hoạt cần ít nhất 1 người.',
    room && occupants.length > room.maxOccupants && `Vượt sức chứa phòng (${occupants.length}/${room.maxOccupants}).`,
    v.representative && !v.representative.phone && 'Người đại diện chưa có số điện thoại.',
    room?.status === 'Maintenance' && 'Phòng đang bảo trì — lưu nháp được nhưng chưa kích hoạt được.',
    property && !property.lessor?.isComplete && 'Khu chưa khai báo đủ bên cho thuê — chưa kích hoạt được.',
  ].filter(Boolean)
  const nameOf = new Map([[v.representative?.id, v.representative?.fullName], ...v.occupants.map((o) => [o.renter.id, o.renter.fullName])])

  return (
    <>
      {warnings.length > 0 && (
        <div className={styles.stack}>
          <Alert tone="warning">
            <strong>Cần xử lý trước khi kích hoạt:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}
      <FormSection title="Tóm tắt">
        <DescriptionList
          items={[
            { label: 'Mẫu', value: template ? template.name : `Không dùng mẫu · ${CONTRACT_TYPE_LABELS[v.contractType]}` },
            { label: 'Phòng', value: room ? `${room.propertyCode} · Phòng ${room.code}` : null },
            { label: 'Người đại diện', value: v.representative?.fullName },
            {
              label: 'Người ở',
              value: occupants.length
                ? occupants.map((o) => `${nameOf.get(o.renterId)}${o.relationshipType ? ` (${RELATIONSHIP_LABELS[o.relationshipType]})` : ''}`).join(', ')
                : null,
            },
            { label: 'Thời hạn', value: `${formatDate(v.startDate)} → ${v.indefinite ? 'Không thời hạn' : formatDate(v.endDate)}` },
            { label: 'Giá thuê', value: formatMoney(v.monthlyRent ?? room?.listedRent) },
            { label: 'Tiền cọc', value: template?.noDeposit ? 'Không cọc' : formatMoney(v.depositAmount ?? room?.defaultDeposit ?? 0) },
            { label: 'Phương thức thanh toán', value: v.paymentMethods.map((m) => PAYMENT_METHOD_LABELS[m]).join(', ') },
            { label: 'Kỳ thu', value: `Chốt ngày ${v.billing.anchorDay} · ${CHARGE_MODE_LABELS[v.billing.chargeMode]} · hạn ${v.billing.paymentDueDays} ngày` },
          ]}
        />
      </FormSection>
      <p className={styles.muted}>Lưu nháp → sang trang chi tiết để ghi tài sản bàn giao, đăng ký xe, rồi bấm Kích hoạt khi bàn giao phòng.</p>
    </>
  )
}
