import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfGenerationService } from '../../../services/pdf-generation.service';

@Component({
  selector: 'app-ticket-pdf',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket-pdf.component.html',
  styleUrls: ['./ticket-pdf.component.css']
})
export class TicketPdfComponent implements OnInit {
  // Input từ component cha
  @Input() seats: any[] = [];
  @Input() orderItems: any[] = [];
  @Input() showtimeInfo: any;
  @Input() orderInfo: any;
  @Input() pdfMode: 'download' | 'preview' = 'preview';

  // Output events
  @Output() pdfGenerated = new EventEmitter<any>();
  @Output() pdfError = new EventEmitter<any>();

  // Properties cho giao diện
  isGenerating: boolean = false;
  error: string | null = null;
  
  constructor(private pdfService: PdfGenerationService) { }

  ngOnInit(): void {
    // Khởi tạo thành phần khi component được tạo
  }

  /**
   * Phương thức được gọi khi muốn tạo và hiển thị PDF
   */
  async generatePdf(): Promise<void> {
    this.isGenerating = true;
    this.error = null;
    
    try {
      // Gọi service để tạo PDF
      const result = await this.pdfService.generateTicketPdf(
        this.seats,
        this.orderItems,
        this.showtimeInfo,
        this.orderInfo
      );
      
      // Xử lý kết quả
      if (this.pdfMode === 'download') {
        this.pdfService.downloadPdf(result, `ve-phim-${this.orderInfo?.orderId || 'unknown'}.pdf`);
      } else {
        this.pdfService.openPdfInNewTab(result);
      }
      
      // Thông báo thành công
      this.pdfGenerated.emit(result);
    } catch (err: any) {
      // Xử lý lỗi
      this.error = err.message || 'Không thể tạo file PDF. Vui lòng thử lại sau.';
      this.pdfError.emit(err);
    } finally {
      this.isGenerating = false;
    }
  }
  
  /**
   * Chuẩn bị dữ liệu hiển thị cho vé
   * @param seat Thông tin ghế
   * @returns Object chứa dữ liệu đã được xử lý
   */
  prepareTicketData(seat: any): any {
    // Bạn có thể thêm logic xử lý dữ liệu ở đây
    return {
      ...seat,
      // Thêm các dữ liệu đã được xử lý
      formattedPrice: seat.SeatPrice ? `${seat.SeatPrice.toLocaleString()}đ` : 'Chưa xác định'
    };
  }
  
  /**
   * Tính tổng tiền của các mặt hàng trong hóa đơn
   * @returns Tổng số tiền
   */
  calculateTotal(): number {
    if (!this.orderItems || this.orderItems.length === 0) {
      return 0;
    }
    
    return this.orderItems.reduce((total, item) => {
      const quantity = item.quantity || item.count || 1;
      const price = item.price || 0;
      return total + (quantity * price);
    }, 0);
  }
}
