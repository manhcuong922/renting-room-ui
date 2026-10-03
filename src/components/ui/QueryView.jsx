import { TableSkeleton } from './DataTable'
import { ErrorState, PageLoader } from './Feedback'

/**
 * Hiển thị theo trạng thái của một useQuery: đang tải → skeleton, lỗi → ErrorState + Thử lại,
 * rỗng → `empty`, có dữ liệu → children(data).
 *
 *   <QueryView query={listQuery} isEmpty={(d) => d.items.length === 0} empty={<EmptyState … />}>
 *     {(data) => <DataTable rows={data.items} … />}
 *   </QueryView>
 */
export function QueryView({ query, isEmpty, empty = null, loading = 'table', errorTitle, children }) {
  if (query.isPending) {
    if (loading === 'table') return <TableSkeleton />
    if (loading === 'page') return <PageLoader />
    return loading
  }
  if (query.isError) return <ErrorState error={query.error} title={errorTitle} onRetry={() => void query.refetch()} />
  if (isEmpty?.(query.data)) return empty
  return children(query.data)
}
