// Lỗi chuẩn hóa từ ProblemDetails (RFC 9457) của backend — xem renting_room/docs/api/errors.md.
// Luôn xử lý theo `code`, không theo câu chữ; `detail` là tiếng Việt hiển thị được (trừ 5xx).
export class ApiError extends Error {
  constructor({ status, code, title, detail, errors, traceId, instance, retryAfter, cause } = {}) {
    super(detail || title || code || 'Đã có lỗi xảy ra', { cause })
    this.name = 'ApiError'
    this.status = status ?? 0
    this.code = code ?? 'UNKNOWN'
    this.title = title ?? null
    this.detail = detail ?? null
    this.errors = errors ?? null
    this.traceId = traceId ?? null
    this.instance = instance ?? null
    this.retryAfter = retryAfter ?? null
  }

  get isValidation() {
    return this.status === 400 && this.code === 'VALIDATION_FAILED'
  }

  get isNetwork() {
    return this.status === 0
  }

  // { 'renter.fullName': 'Họ tên là bắt buộc.' } — gắn thẳng vào từng ô form.
  fieldErrors() {
    if (!this.errors) return {}
    return Object.fromEntries(
      Object.entries(this.errors).map(([field, messages]) => [
        field,
        Array.isArray(messages) ? messages[0] : String(messages),
      ]),
    )
  }

  static async fromResponse(response) {
    const retryAfterHeader = response.headers.get('Retry-After')
    const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) || null : null

    let problem = {}
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('json')) {
      try {
        problem = await response.json()
      } catch {
        problem = {}
      }
    }

    return new ApiError({
      status: response.status,
      code: problem.code ?? fallbackCode(response.status),
      title: problem.title,
      detail: problem.detail,
      errors: problem.errors,
      traceId: problem.traceId,
      instance: problem.instance,
      retryAfter,
    })
  }

  static network(cause) {
    const timedOut = cause?.name === 'TimeoutError'
    return new ApiError({
      status: 0,
      code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      detail: timedOut
        ? 'Máy chủ phản hồi quá lâu, vui lòng thử lại.'
        : 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.',
      cause,
    })
  }
}

function fallbackCode(status) {
  if (status === 401) return 'AUTHENTICATION_REQUIRED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 429) return 'TOO_MANY_REQUESTS'
  if (status >= 500) return 'INTERNAL_ERROR'
  return 'BAD_REQUEST'
}

// Câu thông báo cho người dùng theo bảng "Xử lý chung trong interceptor".
export function getErrorMessage(error) {
  if (!(error instanceof ApiError)) return 'Đã có lỗi xảy ra.'
  if (error.status >= 500) {
    return error.traceId
      ? `Đã có lỗi xảy ra. Mã tra cứu: ${error.traceId}`
      : 'Đã có lỗi xảy ra.'
  }
  if (error.status === 403 && error.code === 'FORBIDDEN') return 'Bạn không có quyền thực hiện thao tác này.'
  if (error.status === 404 && !error.detail) return 'Không tìm thấy dữ liệu.'
  if (error.status === 413) return 'Dữ liệu quá lớn.'
  if (error.status === 429) {
    return error.retryAfter
      ? `Bạn thao tác quá nhanh, thử lại sau ${error.retryAfter} giây.`
      : 'Bạn thao tác quá nhanh, vui lòng thử lại sau.'
  }
  return error.detail || error.title || 'Đã có lỗi xảy ra.'
}
