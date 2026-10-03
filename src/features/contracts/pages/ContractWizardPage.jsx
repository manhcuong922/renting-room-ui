import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { contractsApi, contractTemplatesApi, propertiesApi, queryKeys, rentersApi, roomsApi } from '@/api'
import { Alert, Button, Card, PageHeader, PageLoader, QueryView, useToast } from '@/components/ui'
import { CONTRACT_WARNING_LABELS } from '@/constants/enums'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { cx } from '@/lib/cx'
import { WIZARD_STEPS, buildContractInput, draftToForm, emptyContractForm, remapServerErrors, stepOfField, validateStep } from '../contractForm'
import { PeopleStep } from '../wizard/PeopleStep'
import { DocumentStep, ReviewStep, RoomStep, TemplateStep, TermsStep } from '../wizard/WizardSteps'
import styles from '../wizard/Wizard.module.css'

/** /contracts/new[?roomId=] (tạo nháp) hoặc /contracts/:id/edit (sửa nháp). */
export default function ContractWizardPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()

  // Sửa nháp: cần hồ sơ đầy đủ của người thuê (giới tính / ngày sinh để lọc quan hệ) + mẫu (so điều khoản).
  const draft = useQuery({
    queryKey: [...queryKeys.contracts.detail(id), 'wizard'],
    enabled: Boolean(id),
    queryFn: async ({ signal }) => {
      const contract = await contractsApi.get(id, { signal })
      const ids = [...new Set([contract.representativeRenterId, ...contract.occupants.map((o) => o.renterId)])]
      const [renters, template] = await Promise.all([
        Promise.all(ids.map((rid) => rentersApi.get(rid, { signal }))),
        contract.document?.templateId ? contractTemplatesApi.get(contract.document.templateId, { signal }).catch(() => null) : null,
      ])
      return { contract, renters: new Map(renters.map((r) => [r.id, r])), template }
    },
    gcTime: 0,
  })

  if (id) {
    return (
      <QueryView query={draft} loading="page" errorTitle="Không tải được hợp đồng">
        {({ contract, renters, template }) =>
          contract.status === 'Draft' ? (
            <Wizard key={contract.version} contract={contract} initial={draftToForm(contract, renters, template)} />
          ) : (
            <Alert tone="warning">Chỉ sửa được hợp đồng nháp.</Alert>
          )
        }
      </QueryView>
    )
  }
  return <Wizard initial={emptyContractForm()} presetRoomId={searchParams.get('roomId')} />
}

function Wizard({ initial, contract, presetRoomId }) {
  const editing = Boolean(contract)
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const [stepIndex, setStepIndex] = useState(editing ? 2 : 0)
  const form = useForm(initial, {
    codeFields: {
      MONTHLY_RENT_REQUIRED: 'monthlyRent',
      DEPOSIT_NOT_ALLOWED: 'depositAmount',
      DEPOSIT_TOO_HIGH: 'depositAmount',
      CONTRACT_NO_TAKEN: 'contractNo',
      ROOM_ARCHIVED: 'roomId',
      CONTRACT_TEMPLATE_ARCHIVED: 'templateId',
      HOUSEHOLD_HEAD_NOT_OCCUPANT: 'householdHeadRenterId',
    },
  })
  const v = form.values
  const step = WIZARD_STEPS[stepIndex].id

  const templates = useQuery({
    queryKey: queryKeys.contractTemplates.list({ includeArchived: true }),
    queryFn: ({ signal }) => contractTemplatesApi.list({ includeArchived: true }, { signal }),
  })
  const template = (templates.data ?? []).find((t) => t.id === v.templateId) ?? null
  const room = useQuery({
    queryKey: queryKeys.rooms.detail(v.roomId),
    queryFn: ({ signal }) => roomsApi.get(v.roomId, { signal }),
    enabled: Boolean(v.roomId),
  }).data
  const property = useQuery({
    queryKey: queryKeys.properties.detail(v.propertyId),
    queryFn: ({ signal }) => propertiesApi.get(v.propertyId, { signal }),
    enabled: Boolean(v.propertyId),
  }).data

  // Chọn phòng → gợi ý giá / cọc từ phòng, cài đặt thu từ khu (chỉ khi tạo mới).
  const selectRoom = async (r) => {
    form.setValue('roomId', r.id)
    form.setValue('propertyId', r.propertyId)
    if (editing) return
    form.setValue('monthlyRent', r.listedRent ?? null)
    if (!template?.noDeposit) form.setValue('depositAmount', r.defaultDeposit ?? null)
    const p = await queryClient.fetchQuery({ queryKey: queryKeys.properties.detail(r.propertyId), queryFn: () => propertiesApi.get(r.propertyId) })
    const { anchorDay, chargeMode, prorationMode, paymentDueDays, noticeDays } = p.billingDefaults
    form.setValue('billing', { anchorDay, chargeMode, prorationMode, paymentDueDays })
    form.setValue('noticeDays', noticeDays)
  }

  const selectTemplate = (t) => {
    form.setValue('templateId', t?.id ?? '')
    if (t?.noDeposit) form.setValue('depositAmount', 0)
    // Giữ giá trị của trường trùng key, bỏ trường không thuộc mẫu mới.
    const keep = Object.fromEntries((t?.fields ?? []).map((f) => [f.key, v.customFields[f.key] ?? (f.type === 'Boolean' ? false : undefined)]))
    form.setValue('customFields', keep)
    if (!t) form.setValue('overrideClauses', v.clauses.length > 0)
  }

  // Mở từ sơ đồ phòng (?roomId=) → chọn sẵn phòng.
  const [presetLoading, setPresetLoading] = useState(Boolean(presetRoomId))
  const presetStarted = useRef(false)
  useEffect(() => {
    if (!presetRoomId || presetStarted.current) return
    presetStarted.current = true
    roomsApi
      .get(presetRoomId)
      .then((r) => selectRoom(r))
      .catch(() => toast.error('Không tải được phòng đã chọn.'))
      .finally(() => setPresetLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy một lần khi mở trang
  }, [presetRoomId])

  const goTo = (index) => {
    form.setErrors({})
    form.setFormError(null)
    setStepIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const next = () => {
    const errors = validateStep(step, v, { template, room })
    if (Object.keys(errors).length) {
      form.setErrors(errors)
      form.setFormError('Vui lòng kiểm tra các ô được đánh dấu.')
      return
    }
    goTo(stepIndex + 1)
  }

  const save = form.handleSubmit(async (values) => {
    // Kiểm tra lại mọi bước trước khi gửi.
    for (const [index, s] of WIZARD_STEPS.entries()) {
      const errors = validateStep(s.id, values, { template, room })
      if (Object.keys(errors).length) {
        setStepIndex(index)
        form.setErrors(errors)
        form.setFormError('Vui lòng kiểm tra các ô được đánh dấu.')
        return
      }
    }
    const input = buildContractInput(values, template)
    const repIncluded = values.representativeIsOccupant && Boolean(values.representative)
    try {
      if (editing) {
        await contractsApi.update(contract.id, { contract: input, version: contract.version })
        await invalidate(queryKeys.contracts.all, queryKeys.rooms.all)
        toast.success('Đã lưu hợp đồng nháp.')
        void navigate(`/contracts/${contract.id}`, { replace: true })
      } else {
        const body = { roomId: values.roomId, contractNo: values.contractNo.trim() || null, contract: input }
        const result = await contractsApi.create(body, { idempotencyKey: idem.keyFor(body) })
        await invalidate(queryKeys.contracts.all, queryKeys.rooms.all)
        toast.success('Đã lưu hợp đồng nháp.')
        for (const w of result.warnings ?? []) toast.warning(w.message ?? CONTRACT_WARNING_LABELS[w.code] ?? w.code)
        void navigate(`/contracts/${result.id}`, { replace: true })
      }
    } catch (error) {
      // Index người ở của server lệch với form khi người đứng tên ở cùng → chuyển lại key, rồi nhảy tới bước có lỗi.
      if (error.errors) error.errors = remapServerErrors(error.errors, repIncluded)
      const firstKey = Object.keys(error.errors ?? {})[0]
      if (firstKey) setStepIndex(WIZARD_STEPS.findIndex((s) => s.id === stepOfField(firstKey)))
      throw error
    }
  })

  if (presetLoading) return <PageLoader />

  const isLast = stepIndex === WIZARD_STEPS.length - 1

  return (
    <>
      <PageHeader
        backTo={editing ? `/contracts/${contract.id}` : '/contracts'}
        backLabel={editing ? contract.contractNo : 'Hợp đồng'}
        title={editing ? `Sửa nháp ${contract.contractNo}` : 'Tạo hợp đồng'}
        description={room ? `${room.propertyCode} · Phòng ${room.code}` : 'Lưu nháp trước, kích hoạt khi bàn giao phòng.'}
      />

      <ol className={styles.stepper} aria-label="Các bước">
        {WIZARD_STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={cx(styles.step, i < stepIndex && styles.stepDone, i === stepIndex && styles.stepCurrent)}
              aria-current={i === stepIndex ? 'step' : undefined}
              disabled={i >= stepIndex}
              onClick={() => goTo(i)}
            >
              <span className={styles.stepNumber}>{i + 1}</span>
              {s.label}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        {form.formError && (
          <div className={styles.stack} style={{ marginTop: 0 }}>
            <Alert>{form.formError}</Alert>
          </div>
        )}
        {step === 'template' && <TemplateStep form={form} templates={templates} onSelectTemplate={selectTemplate} />}
        {step === 'room' && <RoomStep form={form} onSelectRoom={selectRoom} locked={editing} />}
        {step === 'people' && <PeopleStep form={form} room={room} />}
        {step === 'terms' && <TermsStep form={form} template={template} room={room} creating={!editing} />}
        {step === 'document' && <DocumentStep form={form} template={template} />}
        {step === 'review' && <ReviewStep form={form} template={template} room={room} property={property} />}
      </Card>

      <div className={styles.nav}>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0 || form.submitting}>
          Quay lại
        </Button>
        <div className={styles.navRight}>
          {editing && !isLast && (
            <Button variant="secondary" icon={Save} onClick={save} loading={form.submitting}>
              Lưu
            </Button>
          )}
          {isLast ? (
            <Button icon={Save} onClick={save} loading={form.submitting}>
              {editing ? 'Lưu thay đổi' : 'Lưu nháp'}
            </Button>
          ) : (
            <Button onClick={next}>
              Tiếp <ArrowRight size={16} aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
