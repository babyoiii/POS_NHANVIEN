import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-refund-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './refund-ticket.component.html',
  styleUrl: './refund-ticket.component.css',
  providers: [DatePipe]
})
export class RefundTicketComponent implements OnInit {
  refundForm!: FormGroup;
  isLoading = false;
  refundResult: any = null;
  errorMessage: string = '';
  successMessage: string = '';
  currentDateFormatted: string = '';
  
  // Thông tin phim và rạp (giả lập)
  private showtimesCache: { [key: string]: any } = {};
  
  constructor(
    private ticketService: TicketService,
    private fb: FormBuilder,
    private datePipe: DatePipe
  ) {
    // Khởi tạo ngày hiện tại được định dạng
    this.currentDateFormatted = this.formatDate(new Date());
  }
  
  ngOnInit(): void {
    this.initForm();
  }
  
  private initForm(): void {
    this.refundForm = this.fb.group({
      orderCode: ['', [Validators.required, Validators.minLength(6)]]
    });
  }
  
  onSubmit(): void {
    if (this.refundForm.invalid) {
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.refundResult = null;
    
    const orderCode = this.refundForm.get('orderCode')?.value;
    
    this.ticketService.refundOrder(orderCode).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.responseCode === 200) {
          this.successMessage = response.message;
          this.refundResult = response.refundDetails;
          this.refundForm.reset();
        } else {
          this.errorMessage = response.message || 'Hoàn vé không thành công';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Có lỗi xảy ra khi hoàn vé. Vui lòng thử lại sau.';
      }
    });
  }
  
  resetForm(): void {
    this.refundForm.reset();
    this.errorMessage = '';
    this.successMessage = '';
    this.refundResult = null;
  }
  
  /**
   * Định dạng ngày tháng
   * @param date Ngày cần định dạng
   * @returns Chuỗi ngày tháng đã định dạng
   */
  formatDate(date: Date): string {
    return this.datePipe.transform(date, 'dd/MM/yyyy HH:mm:ss') || '';
  }
  
  /**
   * Định dạng ngày giờ cho suất chiếu
   * @param datetime Chuỗi thời gian
   * @returns Chuỗi thời gian đã định dạng
   */
  formatDateTime(datetime: string | null): string {
    if (!datetime) return 'Không có thông tin';
    
    try {
      // Nếu là ID, trả về một thời gian giả lập
      if (datetime.includes('-')) {
        // Sử dụng thời gian hiện tại + 3 giờ làm suất chiếu giả lập
        const futureDate = new Date();
        futureDate.setHours(futureDate.getHours() + 3);
        return `Ngày ${this.datePipe.transform(futureDate, 'dd/MM/yyyy')} - ${this.datePipe.transform(futureDate, 'HH:mm')}`;
      } 
      
      const date = new Date(datetime);
      return `Ngày ${this.datePipe.transform(date, 'dd/MM/yyyy')} - ${this.datePipe.transform(date, 'HH:mm')}`;
    } catch (e) {
      return 'Không có thông tin';
    }
  }
  
  /**
   * Lấy thông tin suất chiếu từ ID
   * @param showTimeId ID suất chiếu
   * @returns Thông tin suất chiếu hoặc ID nếu không tìm thấy
   */
  getShowtime(showTimeId: string | null): string {
    if (!showTimeId) return 'Không có thông tin';
    
    // Trong thực tế, đây là nơi bạn sẽ gọi API để lấy thông tin suất chiếu
    // Để đơn giản, chúng ta sử dụng ID làm thông tin suất chiếu
    if (this.showtimesCache[showTimeId]) {
      return this.showtimesCache[showTimeId];
    }
    
    return showTimeId;
  }
  
  /**
   * In biên lai hoàn vé
   */
  printReceipt(): void {
    // Lưu nội dung hiện tại của trang
    const originalContent = document.body.innerHTML;
    
    // Lấy chỉ phần biên lai
    const receiptElement = document.querySelector('.receipt-card');
    
    if (receiptElement) {
      // Thiết lập CSS cần thiết cho việc in
      const printStyles = `
        <style>
          @page {
            size: 80mm auto;
            margin: 5mm;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          .card-header {
            background: linear-gradient(135deg, #43cea2 0%, #185a9d 100%);
            color: white;
            padding: 15px;
            text-align: center;
          }
          .receipt-header {
            text-align: center;
            margin-bottom: 15px;
          }
          .divider {
            height: 1px;
            background: #eee;
            margin: 10px 0;
          }
          .receipt-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .receipt-footer {
            text-align: center;
            margin-top: 15px;
            font-size: 0.9em;
          }
        </style>
      `;
      
      // Thay thế nội dung trang bằng phần biên lai
      document.body.innerHTML = printStyles + receiptElement.outerHTML;
      
      // In trang
      window.print();
      
      // Khôi phục nội dung gốc
      document.body.innerHTML = originalContent;
    } else {
      console.error('Không tìm thấy phần tử biên lai để in');
      window.print(); // Fallback nếu không tìm thấy biên lai
    }
  }
}
