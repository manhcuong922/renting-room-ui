// "Đơn giá nước" → "don_gia_nuoc" (key trường tùy biến: chữ thường không dấu, số, _; bắt đầu bằng chữ).
export function toFieldKey(label) {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '')
  return base.slice(0, 40)
}
