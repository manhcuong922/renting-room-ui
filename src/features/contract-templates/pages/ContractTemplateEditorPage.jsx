import { useQuery } from '@tanstack/react-query'
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { contractTemplatesApi, queryKeys } from '@/api'
import {
  Alert,
  Badge,
  Button,
  Card,
  CheckboxField,
  ConfirmDialog,
  FormGrid,
  FormSection,
  PageHeader,
  PageLoader,
  QueryView,
  RadioGroup,
  SelectField,
  TextAreaField,
  TextField,
  useToast,
} from '@/components/ui'
import { CONTRACT_TYPE_LABELS, TEMPLATE_FIELD_TYPE_LABELS, toOptions } from '@/constants/enums'
import { useAction, useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { toFieldKey } from '@/lib/text'
import { DEFAULT_TITLES, MAX_CLAUSES, MAX_FIELDS, emptyClause, emptyField, toTemplateBody, toTemplateForm, validateTemplate } from '../templateForm'
import styles from './ContractTemplateEditorPage.module.css'

/** /contract-templates/new[?preset=i] hoặc /contract-templates/:id */
export default function ContractTemplateEditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const presetIndex = searchParams.get('preset')

  const template = useQuery({
    queryKey: queryKeys.contractTemplates.detail(id),
    queryFn: ({ signal }) => contractTemplatesApi.get(id, { signal }),
    enabled: Boolean(id),
  })
  const presets = useQuery({
    queryKey: queryKeys.contractTemplates.presets,
    queryFn: ({ signal }) => contractTemplatesApi.presets({ signal }),
    enabled: !id && presetIndex !== null,
    staleTime: Infinity,
  })

  if (id) {
    return (
      <QueryView query={template} loading="page" errorTitle="Không tải được mẫu">
        {(t) => <TemplateEditor key={t.version} template={t} />}
      </QueryView>
    )
  }
  if (presetIndex !== null && presets.isPending) return <PageLoader />
  const preset = presets.data?.[Number(presetIndex)]
  return <TemplateEditor key={presetIndex ?? 'blank'} preset={preset} />
}

function TemplateEditor({ template, preset }) {
  const editing = Boolean(template)
  const navigate = useNavigate()
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const [confirm, setConfirm] = useState(null)
  const form = useForm(toTemplateForm(template ?? preset), {
    validate: validateTemplate,
    codeFields: { CONTRACT_TEMPLATE_NAME_TAKEN: 'name' },
  })
  const v = form.values

  // Đổi loại hợp đồng mà tiêu đề còn là tiêu đề mặc định → đổi theo.
  const changeType = (type) => {
    form.setValue('contractType', type)
    if (Object.values(DEFAULT_TITLES).includes(v.title.trim())) form.setValue('title', DEFAULT_TITLES[type])
  }

  const keys = [queryKeys.contractTemplates.all]
  const archive = useAction({ mutationFn: () => contractTemplatesApi.archive(template.id), invalidate: keys, success: 'Đã ngừng dùng mẫu.', toastErrors: false })
  const restore = useAction({ mutationFn: () => contractTemplatesApi.restore(template.id), invalidate: keys, success: 'Đã khôi phục mẫu.', toastErrors: false })

  const submit = form.handleSubmit(async (values) => {
    const body = toTemplateBody(values)
    if (editing) {
      await contractTemplatesApi.update(template.id, { ...body, version: template.version })
      await invalidate(...keys)
      toast.success('Đã lưu mẫu. Hợp đồng nháp dùng mẫu này nhận nội dung mới ở lần sửa kế tiếp.')
    } else {
      const { id } = await contractTemplatesApi.create(body, { idempotencyKey: idem.keyFor(body) })
      await invalidate(...keys)
      toast.success('Đã tạo mẫu hợp đồng.')
      void navigate(`/contract-templates/${id}`, { replace: true })
    }
  })

  const move = (list, index, delta) => {
    const next = [...v[list]]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    form.setValue(list, next)
  }
  const remove = (list, index) => form.setValue(list, v[list].filter((_, i) => i !== index))

  return (
    <>
      <PageHeader
        backTo="/contract-templates"
        backLabel="Mẫu hợp đồng"
        title={editing ? template.name : 'Tạo mẫu hợp đồng'}
        meta={
          <>
            {preset && <Badge tone="primary">Từ mẫu gợi ý: {preset.name}</Badge>}
            {template?.isArchived && <Badge>Ngừng dùng</Badge>}
          </>
        }
        actions={
          editing &&
          (template.isArchived ? (
            <Button variant="secondary" icon={ArchiveRestore} onClick={() => setConfirm('restore')}>
              Khôi phục
            </Button>
          ) : (
            <Button variant="ghost" icon={Archive} onClick={() => setConfirm('archive')}>
              Ngừng dùng
            </Button>
          ))
        }
      />

      <form onSubmit={submit} noValidate>
        {form.formError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert>{form.formError}</Alert>
          </div>
        )}

        <Card>
          <FormSection title="Thông tin mẫu">
            <FormGrid>
              <TextField label="Tên mẫu" required maxLength={200} placeholder="VD Thuê trọ khu Quang Minh" {...form.field('name')} />
              <RadioGroup label="Loại hợp đồng" options={toOptions(CONTRACT_TYPE_LABELS)} value={v.contractType} onChange={changeType} />
              <TextField label="Tiêu đề in trên hợp đồng" maxLength={200} className="span-full" {...form.field('title')} />
              <CheckboxField
                className="span-full"
                label="Hợp đồng không cọc"
                description="Tiền cọc luôn = 0 khi dùng mẫu này (ô tiền cọc bị khóa trên hợp đồng)."
                {...form.field('noDeposit', { type: 'checkbox' })}
              />
            </FormGrid>
          </FormSection>
        </Card>

        <Card className={styles.block}>
          <div className={styles.blockHeader}>
            <div>
              <h2 className={styles.blockTitle}>Điều khoản ({v.clauses.length}/{MAX_CLAUSES})</h2>
              <p className={styles.blockHint}>In theo thứ tự. Xuống dòng trong nội dung được giữ nguyên.</p>
            </div>
            <Button variant="secondary" icon={Plus} disabled={v.clauses.length >= MAX_CLAUSES} onClick={() => form.setValue('clauses', [...v.clauses, emptyClause()])}>
              Thêm điều khoản
            </Button>
          </div>
          <ol className={styles.items}>
            {v.clauses.map((_, i) => (
              <li key={i} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemIndex}>Điều {i + 1}</span>
                  <ItemControls index={i} count={v.clauses.length} onMove={(d) => move('clauses', i, d)} onRemove={() => remove('clauses', i)} />
                </div>
                <FormGrid cols={1}>
                  <TextField label="Tiêu đề" required maxLength={200} {...form.field(`clauses.${i}.heading`)} />
                  <TextAreaField label="Nội dung" required rows={5} maxLength={10_000} {...form.field(`clauses.${i}.body`)} />
                </FormGrid>
              </li>
            ))}
          </ol>
        </Card>

        <Card className={styles.block}>
          <div className={styles.blockHeader}>
            <div>
              <h2 className={styles.blockTitle}>Trường tùy biến ({v.fields.length}/{MAX_FIELDS})</h2>
              <p className={styles.blockHint}>Ô nhập thêm khi lập hợp đồng (VD cách tính điện, tiền nước). Chỉ ghi nhận thỏa thuận, không tự tính tiền.</p>
            </div>
            <Button variant="secondary" icon={Plus} disabled={v.fields.length >= MAX_FIELDS} onClick={() => form.setValue('fields', [...v.fields, emptyField()])}>
              Thêm trường
            </Button>
          </div>
          <ol className={styles.items}>
            {v.fields.map((f, i) => (
              <li key={i} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemIndex}>{f.label || `Trường ${i + 1}`}</span>
                  <ItemControls index={i} count={v.fields.length} onMove={(d) => move('fields', i, d)} onRemove={() => remove('fields', i)} />
                </div>
                <FormGrid cols={3}>
                  <TextField
                    label="Nhãn"
                    required
                    maxLength={100}
                    {...form.field(`fields.${i}.label`)}
                    onBlur={() => !f.key && f.label && form.setValue(`fields.${i}.key`, toFieldKey(f.label))}
                  />
                  <TextField label="Key" required maxLength={40} hint="Tự sinh từ nhãn" {...form.field(`fields.${i}.key`)} />
                  <SelectField label="Kiểu" options={toOptions(TEMPLATE_FIELD_TYPE_LABELS)} {...form.field(`fields.${i}.type`)} />
                  {f.type === 'Select' && (
                    <TextAreaField
                      label="Các lựa chọn"
                      required
                      rows={3}
                      className="span-full"
                      hint="Mỗi dòng một lựa chọn (1–30)."
                      {...form.field(`fields.${i}.optionsText`)}
                      error={form.errors[`fields.${i}.optionsText`] ?? form.errors[`fields.${i}.options`]}
                    />
                  )}
                  <TextField label="Đơn vị" maxLength={20} placeholder="đ/kWh, m²…" {...form.field(`fields.${i}.unit`)} />
                  <TextField label="Gợi ý" maxLength={200} {...form.field(`fields.${i}.hint`)} />
                  <CheckboxField label="Bắt buộc nhập" {...form.field(`fields.${i}.required`, { type: 'checkbox' })} />
                </FormGrid>
              </li>
            ))}
          </ol>
        </Card>

        <div className={styles.saveBar}>
          <Button variant="secondary" onClick={() => void navigate('/contract-templates')} disabled={form.submitting}>
            Hủy
          </Button>
          <Button type="submit" loading={form.submitting}>
            {editing ? 'Lưu mẫu' : 'Tạo mẫu'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirm === 'archive'}
        onClose={() => setConfirm(null)}
        title="Ngừng dùng mẫu?"
        message="Mẫu bị ẩn và không chọn được cho hợp đồng mới. Hợp đồng nháp đang dùng mẫu vẫn sửa được."
        confirmLabel="Ngừng dùng"
        tone="danger"
        onConfirm={() => archive.mutateAsync()}
      />
      <ConfirmDialog open={confirm === 'restore'} onClose={() => setConfirm(null)} title="Khôi phục mẫu?" confirmLabel="Khôi phục" onConfirm={() => restore.mutateAsync()} />
    </>
  )
}

function ItemControls({ index, count, onMove, onRemove }) {
  return (
    <span className={styles.controls}>
      <Button variant="ghost" size="sm" iconOnly icon={ArrowUp} disabled={index === 0} onClick={() => onMove(-1)}>
        Lên
      </Button>
      <Button variant="ghost" size="sm" iconOnly icon={ArrowDown} disabled={index === count - 1} onClick={() => onMove(1)}>
        Xuống
      </Button>
      <Button variant="ghost" size="sm" iconOnly icon={Trash} onClick={onRemove}>
        Xóa
      </Button>
    </span>
  )
}
