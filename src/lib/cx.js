// Ghép className, bỏ giá trị falsy: cx('a', cond && 'b') → 'a b'
export function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}
