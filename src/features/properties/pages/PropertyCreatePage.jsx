import { useNavigate } from 'react-router'
import { propertiesApi, queryKeys } from '@/api'
import { Button, Card, PageHeader, useToast } from '@/components/ui'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { PropertyFormFields } from '../components/PropertyFormFields'
import { toPropertyBody, toPropertyForm, validateProperty } from '../propertyForm'

// Bước 1 của "khu mới" (docs/api/properties.md#wizard-khu-mới-gợi-ý) → sang tab Bên cho thuê.
export default function PropertyCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const form = useForm(toPropertyForm(null), {
    validate: (v) => validateProperty(v, { creating: true }),
    codeFields: { PROPERTY_CODE_TAKEN: 'code' },
  })

  const submit = form.handleSubmit(async (v) => {
    const body = { code: v.code.trim().toUpperCase(), ...toPropertyBody(v) }
    const { id } = await propertiesApi.create(body, { idempotencyKey: idem.keyFor(body) })
    await invalidate(queryKeys.properties.all)
    toast.success('Đã tạo khu. Tiếp theo: khai báo bên cho thuê để ký được hợp đồng.')
    void navigate(`/properties/${id}?tab=lessor`, { replace: true })
  })

  return (
    <>
      <PageHeader backTo="/properties" backLabel="Khu trọ" title="Tạo khu trọ" description="Sau khi tạo: khai báo bên cho thuê → ngân hàng → tạo phòng." />
      <Card>
        <form onSubmit={submit} noValidate>
          <PropertyFormFields form={form} creating />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>
            <Button variant="secondary" onClick={() => void navigate('/properties')} disabled={form.submitting}>
              Hủy
            </Button>
            <Button type="submit" loading={form.submitting}>
              Tạo khu
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
