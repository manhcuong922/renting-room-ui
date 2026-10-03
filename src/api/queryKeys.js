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
  members: resource('members'),
  properties: resource('properties'),
  rooms: { ...resource('rooms'), groups: (propertyId) => ['rooms', 'groups', propertyId] },
  renters: resource('renters'),
  contractTemplates: { ...resource('contract-templates'), presets: ['contract-templates', 'presets'] },
  contracts: { ...resource('contracts'), billingPeriods: (id, until) => ['contracts', 'billing-periods', id, until ?? null] },
}
