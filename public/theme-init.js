// Áp chế độ giao diện đã lưu TRƯỚC khi trang vẽ lần đầu (tránh nháy sáng rồi mới tối). Là tệp riêng vì CSP bản build chỉ cho script 'self'.
// Giá trị lưu: 'light' | 'dark'; không có = theo hệ điều hành. Logic đầy đủ ở src/lib/theme.js.
;(function () {
  try {
    var theme = localStorage.getItem('rr-theme')
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme)
  } catch {
    /* localStorage bị chặn: dùng theo hệ điều hành */
  }
})()
