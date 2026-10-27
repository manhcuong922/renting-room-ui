// Khóa React Query tập trung. Invalidate theo tiền tố:
//   queryClient.invalidateQueries({ queryKey: queryKeys.properties.all })
const resource = (name) => ({
  all: [name],
  list: (params) => [name, 'list', params],
  detail: (id) => [name, 'detail', id],
})

export const queryKeys = {
  me: ['me'],
  organizations: resource('organizations'),
  members: { ...resource('members'), loginEvents: (params) => ['members', 'login-events', params] },
  properties: {
    ...resource('properties'),
    billingPreview: (id, anchorDay, chargeMode) => ['properties', 'billing-preview', id, anchorDay, chargeMode],
  },
  organization: { all: ['organization'], info: ['organization', 'info'], lessor: ['organization', 'lessor'], dataRetention: ['organization', 'data-retention'] },
  rooms: {
    ...resource('rooms'),
    groups: (propertyId) => ['rooms', 'groups', propertyId],
    tenancyHistory: (roomId) => ['rooms', 'tenancy-history', roomId],
    tenancySearch: (params) => ['rooms', 'tenancy-search', params],
    meters: (roomId, params) => ['rooms', 'meters', roomId, params ?? null],
  },
  fees: {
    all: ['fees'],
    byProperty: (propertyId, params) => ['fees', 'by-property', propertyId, params ?? null],
    usage: (feeTypeId) => ['fees', 'usage', feeTypeId],
  },
  meters: {
    all: ['meters'],
    readings: (meterId) => ['meters', 'readings', meterId],
    sheet: (propertyId, params) => ['meters', 'sheet', propertyId, params],
    installSheet: (propertyId, feeTypeId) => ['meters', 'install-sheet', propertyId, feeTypeId],
    replaceSheet: (propertyId, feeTypeId) => ['meters', 'replace-sheet', propertyId, feeTypeId],
    vacantUsage: (propertyId, params) => ['meters', 'vacant-usage', propertyId, params],
  },
  invoices: {
    ...resource('invoices'),
    totals: (params) => ['invoices', 'totals', params],
    byRoom: (roomId, params) => ['invoices', 'by-room', roomId, params],
    adjustments: (id) => ['invoices', 'adjustments', id],
  },
  roomCharges: { all: ['room-charges'], list: (params) => ['room-charges', 'list', params], byRoom: (roomId, params) => ['room-charges', 'by-room', roomId, params ?? null] },
  payments: { all: ['payments'], list: (params) => ['payments', 'list', params], balance: (contractId) => ['payments', 'balance', contractId] },
  renters: { ...resource('renters'), consents: (id) => ['renters', 'consents', id] },
  audit: { all: ['audit'], list: (params) => ['audit', 'list', params] },
  contractTemplates: { ...resource('contract-templates'), presets: ['contract-templates', 'presets'] },
  contracts: {
    ...resource('contracts'),
    billingPeriods: (id, until) => ['contracts', 'billing-periods', id, until ?? null],
    dataReview: (propertyId) => ['contracts', 'data-review', propertyId ?? null],
    liquidationPreview: (id, actualEndDate) => ['contracts', 'liquidation-preview', id, actualEndDate ?? null],
  },
}
