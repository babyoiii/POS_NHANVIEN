/**
 * Phương pháp thay thế để hiển thị logo trên hóa đơn
 * 
 * Hướng dẫn sử dụng:
 * 1. Import và sử dụng các phương thức trong file này vào food-selection.component.ts
 * 2. Thay thế phương thức convertLogoToBase64() với phương thức getColoredLogo()
 * 3. Sử dụng mã HTML trong getLogoHtml() thay vì thẻ <img> với base64 trong prepareReceiptContent()
 */

/**
 * Trả về một chuỗi HTML để hiển thị logo dưới dạng text styled hoặc SVG
 */
export function getLogoHtml(): string {
  return `
    <div style="text-align: center; padding: 10px;">
      <div style="font-size: 24px; font-weight: bold; color: #3498db;">CINEX</div>
      <div style="font-size: 12px; color: #555;">Cinema Experience</div>
    </div>
  `;
}

/**
 * Trả về một chuỗi base64 của logo màu
 * Chuỗi này đã được biên dịch trước, không cần tải động từ assets
 */
export function getColoredLogo(): string {
  // Logo màu xanh dương đơn giản đã được encode sẵn thành base64
  return 'data:image/png;base64,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';
}

/**
 * Cách tiếp cận thay thế cho hiển thị logo
 * Sử dụng SVG trực tiếp trong HTML thay vì hình ảnh
 */
export function getSvgLogo(): string {
  return `
    <svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="60" fill="#f0f0f0"/>
      <text x="50" y="30" font-family="Arial" font-size="16" fill="#3498db" text-anchor="middle" dominant-baseline="middle">CINEX</text>
      <text x="50" y="45" font-family="Arial" font-size="8" fill="#555" text-anchor="middle" dominant-baseline="middle">Cinema Experience</text>
    </svg>
  `;
}
