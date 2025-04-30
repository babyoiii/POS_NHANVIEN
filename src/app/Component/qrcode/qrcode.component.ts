import { Component, OnInit, ViewChild, CUSTOM_ELEMENTS_SCHEMA, Inject, PLATFORM_ID, AfterViewInit, NgZone, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';
import { Title } from '@angular/platform-browser';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interface cho CameraDevice từ thư viện html5-qrcode
interface CameraDevice {
  id: string;
  label: string;
}

interface OrderInfo {
  orderId: string;
  orderCode: string;
  customerName: string;
  email: string;
  totalPrice: number;
  formattedTotalPrice: string;
  orderDate: string;
  formattedOrderDate: string;
}

interface Ticket {
  ticketId: string;
  ticketCode: string;
  movieName: string;
  cinemaName: string;
  roomName: string;
  seatInfo: string;
  seatName: string;
  startTime: string;
  endTime: string;
  formattedStartTime: string;
  formattedEndTime: string;
  duration: number;
  formattedDuration: string;
  movieThumbnail: string;
}

interface Service {
  orderServiceId: string;
  serviceName: string;
  serviceType: string;
  quantity: number;
  unitPrice: number;
  formattedUnitPrice: string;
  totalPrice: number;
  formattedTotalPrice: string;
  imageUrl: string;
}

interface TicketResponse {
  responseCode: number;
  message: string;
  orderInfo: OrderInfo;
  tickets: Ticket[];
  services: Service[];
}

@Component({
  selector: 'app-qrcode',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './qrcode.component.html',
  styleUrl: './qrcode.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class QRcodeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('qrReader') qrReaderRef!: ElementRef;
  
  private html5QrCode: Html5Qrcode | null = null;
  private readonly API_URL = 'https://localhost:7263/api/Counter/QRScanner';
  private countdownInterval: any = null;
  private autoResetTimeout: any = null;
  
  // Tiêu đề cố định
  private baseTitleName: string = "Hệ Thống Rạp";
  
  scanResult: string = '';
  isScanning: boolean = true;
  ticketData: TicketResponse | null = null;
  error: string = '';
  isLoading: boolean = false;
  confirmSuccess: boolean = false;
  confirmMessage: string = '';
  countdownTime: number = 5;
  
  // Danh sách các camera có sẵn
  availableCameras: CameraDevice[] = [];
  selectedCameraId: string = '';

  constructor(
    private http: HttpClient, 
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone,
    private titleService: Title
  ) {}

  // Thêm phương thức kiểm tra môi trường cho template
  isPlatformBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Phương thức đặt tiêu đề ngẫu nhiên
  setRandomTitle(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Tạo một mã ngẫu nhiên 8 ký tự
      const randomCode = Math.random().toString(36).substring(2, 10);
      
      // Tạo timestamp hiện tại để đảm bảo không trùng lặp
      const timestamp = new Date().getTime();
      
      // Kết hợp cả hai để có mã hoàn toàn duy nhất
      const uniqueCode = `${randomCode}-${timestamp}`;
      
      // Đặt tiêu đề với mã ngẫu nhiên
      this.titleService.setTitle(`${this.baseTitleName} #${uniqueCode}`);
    }
  }

  ngOnInit(): void {
    console.log('QRcodeComponent initialized');
    this.setRandomTitle(); // Đặt tiêu đề ngẫu nhiên khi khởi tạo component
    
    // Reset dữ liệu khi component khởi tạo
    this.resetAllData();
  }
  
  ngAfterViewInit(): void {
    // Chỉ khởi tạo camera sau khi view đã được tạo và chỉ khi ở browser
    if (isPlatformBrowser(this.platformId)) {
      // Đợi để đảm bảo DOM đã sẵn sàng
      setTimeout(() => {
        this.initQrScanner();
      }, 1000);
    }
  }
  
  ngOnDestroy(): void {
    // Dọn dẹp khi component bị hủy
    this.stopScanner();
    
    // Xóa các dữ liệu lưu trữ
    this.resetAllData();
    
    // Xóa timers
    this.clearTimers();
  }
  
  async initQrScanner(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // Đảm bảo reset dữ liệu cũ
    this.resetAllData();
    
    try {
      // Lấy các thiết bị camera có sẵn
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        this.ngZone.run(() => {
          this.availableCameras = devices;
          console.log('Danh sách camera:', this.availableCameras);
          this.selectedCameraId = devices[0].id;
          this.startScanner();
        });
      } else {
        this.error = 'Không tìm thấy camera nào. Vui lòng kiểm tra quyền truy cập camera.';
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách camera:', err);
      
      // Phân tích lỗi camera và hiển thị thông báo thân thiện hơn
      let errorMessage = 'Không thể truy cập camera.';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Quyền truy cập camera bị từ chối. Vui lòng cho phép quyền truy cập camera trong cài đặt trình duyệt.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'Không tìm thấy camera nào trên thiết bị của bạn. Vui lòng kiểm tra kết nối camera.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera đang được sử dụng bởi ứng dụng khác. Vui lòng đóng các ứng dụng sử dụng camera và thử lại.';
        }
      }
      
      this.error = errorMessage;
    }
  }
  
  startScanner(): void {
    if (!isPlatformBrowser(this.platformId) || !this.qrReaderRef) return;
    
    // Tạo mới instance HTML5QrCode
    const qrReaderElement = this.qrReaderRef.nativeElement;
    this.stopScanner(); // Dừng scanner cũ nếu có
    
    try {
      // Khởi tạo HTML5QrCode
      this.html5QrCode = new Html5Qrcode("reader");
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };
      
      console.log('Bắt đầu khởi động scanner với camera:', this.selectedCameraId);
      
      this.html5QrCode.start(
        this.selectedCameraId,
        config,
        (decodedText) => {
          // Xử lý khi quét thành công
          this.ngZone.run(() => {
            if (this.isScanning) {
              this.isScanning = false;
              this.scanResult = decodedText;
              this.stopScanner();
              this.getTicketInfo(decodedText);
            }
          });
        },
        () => {
          // Không cần xử lý trạng thái quét, chỉ cần tắt debug
        }
      ).catch(err => {
        console.error('Lỗi khi khởi động scanner:', err);
        this.error = `Không thể khởi động scanner: ${err.message || 'Lỗi không xác định'}`;
      });
    } catch (err) {
      console.error('Lỗi khi khởi tạo scanner:', err);
      this.error = 'Không thể khởi tạo scanner. Vui lòng tải lại trang.';
    }
  }
  
  stopScanner(): void {
    if (this.html5QrCode && this.html5QrCode.isScanning) {
      this.html5QrCode.stop().catch(err => {
        console.error('Lỗi khi dừng scanner:', err);
      }).finally(() => {
        this.html5QrCode = null;
      });
    }
  }
  
  changeCamera(deviceId: string): void {
    this.selectedCameraId = deviceId;
    this.stopScanner();
    setTimeout(() => {
      this.startScanner();
    }, 500);
  }

  getTicketInfo(orderCode: string): void {
    this.isLoading = true;
    this.error = '';
    
    // Xóa mọi interval và timeout đang chạy
    this.clearTimers();
    
    this.http.get<TicketResponse>(`${this.API_URL}/GetTicketInfo/${orderCode}`)
      .subscribe({
        next: (response) => {
          this.ticketData = response;
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
          
          // Xử lý các loại lỗi khác nhau
          if (error.status === 404) {
            this.error = `Không tìm thấy vé với mã "${orderCode}". Vé này có thể đã được sử dụng hoặc đã bị hủy.`;
          } else if (error.status === 401 || error.status === 403) {
            this.error = 'Bạn không có quyền truy cập thông tin vé này. Vui lòng liên hệ quản lý.';
          } else if (error.status === 0) {
            this.error = 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.';
          } else if (error.status === 400) {
            this.error = 'Mã QR không hợp lệ. Vui lòng quét lại một mã QR vé hợp lệ.';
          } else {
            this.error = `Có lỗi xảy ra khi đọc thông tin vé. Vui lòng thử lại sau.`;
          }
          
          console.error('Chi tiết lỗi API:', error);
          
          // Bắt đầu đếm ngược để tự động reset scanner
          this.startCountdown();
        }
      });
  }

  confirmTicket(orderCode: string): void {
    this.isLoading = true;
    this.confirmSuccess = false;
    this.confirmMessage = '';
    
    this.http.post<any>(`${this.API_URL}/ConfirmTicket/${orderCode}`, {})
      .subscribe({
        next: (response) => {
          this.confirmSuccess = response.success;
          this.confirmMessage = response.message;
          this.isLoading = false;
        },
        error: (error) => {
          this.error = `Lỗi khi xác nhận vé: ${error.message}`;
          this.isLoading = false;
        }
      });
  }

  resetScanner(): void {
    // Xóa timers
    this.clearTimers();
    
    // Reset tất cả dữ liệu
    this.resetAllData();
    
    // Đặt tiêu đề ngẫu nhiên mỗi khi reset scanner
    this.setRandomTitle();
    
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.startScanner();
      }, 500);
    }
  }

  reloadComponent(): void {
    if (isPlatformBrowser(this.platformId)) {
      console.log('Đang tải lại component...');
      this.stopScanner();
      
      // Đặt lại các biến trạng thái
      this.resetAllData();
      
      // Đặt tiêu đề ngẫu nhiên mỗi khi tải lại component
      this.setRandomTitle();
      
      // Khởi động lại quy trình
      setTimeout(() => {
        this.ngZone.run(() => {
          this.initQrScanner();
        });
      }, 500);
    }
  }

  printTickets(): void {
    if (!this.ticketData) return;

    // Lưu lại nội dung gốc
    const originalContents = document.body.innerHTML;

    // Tạo các trang in riêng biệt
    let printContent = '';

    // 1. In từng vé riêng biệt trên mỗi trang
    this.ticketData.tickets.forEach(ticket => {
      printContent += `
        <div class="print-page">
          <div class="order-header">
            <h3>Thông tin đơn hàng</h3>
            <p class="order-code">Mã đơn hàng: ${this.ticketData?.orderInfo.orderCode}</p>
            <p><strong>Khách hàng:</strong> ${this.ticketData?.orderInfo.customerName}</p>
            <p><strong>Email:</strong> ${this.ticketData?.orderInfo.email}</p>
            <p><strong>Ngày đặt:</strong> ${this.ticketData?.orderInfo.formattedOrderDate}</p>
          </div>
          
          <div class="ticket-single">
            <h3>VÉ XEM PHIM</h3>
            <div class="ticket-movie">
              <img src="${ticket.movieThumbnail}" alt="${ticket.movieName}" class="movie-thumbnail">
              <div class="movie-info">
                <h4>${ticket.movieName}</h4>
                <p class="duration">${ticket.formattedDuration}</p>
              </div>
            </div>
            
            <div class="ticket-details">
              <p><strong>Thời gian:</strong> ${ticket.formattedStartTime}</p>
              <p><strong>Rạp:</strong> ${ticket.cinemaName}</p>
              <p><strong>Phòng:</strong> ${ticket.roomName}</p>
              <p>
                <strong>Ghế:</strong> 
                <span class="seat-label">${ticket.seatName}</span>
              </p>
              <p class="ticket-code"><strong>Mã vé:</strong> ${ticket.ticketCode}</p>
            </div>
          </div>
        </div>
      `;
    });

    // 2. In tất cả dịch vụ trên một trang riêng nếu có dịch vụ
    if (this.ticketData.services && this.ticketData.services.length > 0) {
      printContent += `
        <div class="print-page services-page">
          <div class="order-header">
            <h3>Thông tin đơn hàng</h3>
            <p class="order-code">Mã đơn hàng: ${this.ticketData?.orderInfo.orderCode}</p>
            <p><strong>Khách hàng:</strong> ${this.ticketData?.orderInfo.customerName}</p>
            <p><strong>Email:</strong> ${this.ticketData?.orderInfo.email}</p>
            <p><strong>Ngày đặt:</strong> ${this.ticketData?.orderInfo.formattedOrderDate}</p>
            <p><strong>Tổng tiền:</strong> ${this.ticketData?.orderInfo.formattedTotalPrice}</p>
          </div>
          
          <h3>Dịch vụ đi kèm</h3>
          <div class="services-print">
            ${this.ticketData.services.map(service => `
              <div class="service-item">
                <div class="service-image">
                  <img src="${service.imageUrl}" alt="${service.serviceName}" class="service-thumbnail">
                </div>
                <div class="service-details">
                  <h4>${service.serviceName}</h4>
                  <p class="service-type">${service.serviceType}</p>
                  <p><strong>Số lượng:</strong> ${service.quantity}</p>
                  <p><strong>Đơn giá:</strong> ${service.formattedUnitPrice}</p>
                  <p><strong>Thành tiền:</strong> ${service.formattedTotalPrice}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Thiết lập CSS cho trang in
    const printStyles = `
      <style>
        @media print {
          body, html {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          .print-page {
            page-break-after: always;
            padding: 20px;
          }
          .order-header {
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .order-code {
            font-weight: bold;
            color: #3498db;
          }
          .movie-thumbnail {
            width: 60px;
            height: 80px;
            object-fit: cover;
            border-radius: 4px;
            margin-right: 15px;
          }
          .ticket-movie {
            display: flex;
            padding: 15px;
            background-color: #f0f0f0;
            margin-bottom: 15px;
          }
          .ticket-details {
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
          }
          .seat-label {
            display: inline-block;
            background-color: #3498db;
            color: white;
            font-weight: bold;
            padding: 3px 8px;
            border-radius: 4px;
            margin-left: 5px;
          }
          .services-print {
            display: flex;
            flex-direction: column;
          }
          .service-item {
            display: flex;
            padding: 10px;
            margin-bottom: 10px;
            border: 1px solid #eee;
            border-radius: 8px;
          }
          .service-thumbnail {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 4px;
            margin-right: 15px;
          }
          .ticket-code, h3 {
            color: #3498db;
          }
        }
      </style>
    `;

    // Cập nhật nội dung trang để in
    document.body.innerHTML = printStyles + printContent;
    
    // In
    window.print();
    
    // Khôi phục nội dung trang
    document.body.innerHTML = originalContents;
    
    // Khởi động lại scanner
    setTimeout(() => {
      this.initQrScanner();
    }, 1000);
  }

  // Thêm các phương thức tạo PDF mới 
  
  // In tất cả vé và dịch vụ - hiển thị menu chọn
  printOptions(): void {
    if (!this.ticketData) return;
    
    this.showPrintOptions = true;
  }
  
  // In vé riêng lẻ
  printTicketAsPdf(ticket: Ticket): void {
    if (!this.ticketData) return;
    
    // Tạo mới tài liệu PDF với khổ giấy A6 ngang
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a6'
    });
    
    // Thiết lập font chữ
    doc.setFont("helvetica");
    
    // Tạo tiêu đề trang
    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text("VÉ XEM PHIM", 105, 10, { align: 'center' });
    
    // Thêm thông tin rạp
    doc.setFontSize(12);
    doc.setTextColor(52, 152, 219);
    doc.text("CINEMA STAR", 105, 18, { align: 'center' });
    
    // Phân chia trang thành 2 cột
    
    // CỘT TRÁI - Thông tin phim và suất chiếu
    // Thêm ảnh thumbnail (nếu có URL hợp lệ)
    /* 
    Trong ứng dụng thực tế, bạn cần tải ảnh và chuyển đổi nó thành base64
    Ở đây tôi giả định URL không hợp lệ nên chỉ vẽ khung ảnh
    */
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, 25, 30, 40);
    
    // Thông tin phim
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(ticket.movieName, 45, 30);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Thời lượng: ${ticket.formattedDuration}`, 45, 38);
    
    // Thông tin suất chiếu
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    
    const yStart = 48;
    const lineHeight = 6;
    
    doc.text(`Ngày chiếu: ${ticket.formattedStartTime.split(' ')[0]}`, 45, yStart);
    doc.text(`Giờ chiếu: ${ticket.formattedStartTime.split(' ')[1]}`, 45, yStart + lineHeight);
    doc.text(`Rạp: ${ticket.cinemaName}`, 45, yStart + lineHeight * 2);
    doc.text(`Phòng: ${ticket.roomName}`, 45, yStart + lineHeight * 3);
    
    // CỘT PHẢI - Thông tin vé và khách hàng
    const rightColX = 105;
    
    // Thông tin ghế với định dạng nổi bật
    doc.setFillColor(52, 152, 219);
    doc.setDrawColor(41, 128, 185);
    doc.roundedRect(rightColX, 25, 20, 15, 2, 2, 'FD');
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(ticket.seatName, rightColX + 10, 33, { align: 'center' });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("GHẾ SỐ", rightColX + 10, 38, { align: 'center' });
    
    // Thông tin khách hàng
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    
    doc.text(`Khách hàng: ${this.ticketData?.orderInfo.customerName}`, rightColX, yStart);
    doc.text(`Email: ${this.ticketData?.orderInfo.email}`, rightColX, yStart + lineHeight);
    doc.text(`Mã đơn hàng: ${this.ticketData?.orderInfo.orderCode}`, rightColX, yStart + lineHeight * 2);
    doc.text(`Mã vé: ${ticket.ticketCode}`, rightColX, yStart + lineHeight * 3);
    
    // Thêm lưu ý
    doc.setFontSize(9);
    doc.setTextColor(231, 76, 60);
    doc.text("* Vui lòng có mặt trước giờ chiếu 15 phút", 105, 75, { align: 'center' });
    
    // Thêm chân trang
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Vé hợp lệ khi có dấu mộc của rạp hoặc được quét QR thành công", 105, 82, { align: 'center' });
    
    // Tạo tên file dựa trên mã vé
    const filename = `ve_${ticket.ticketCode}.pdf`;
    
    // Lưu hoặc mở PDF
    doc.save(filename);
  }
  
  // In hóa đơn dịch vụ
  printServicesAsPdf(): void {
    if (!this.ticketData || !this.ticketData.services || this.ticketData.services.length === 0) return;
    
    // Tạo mới tài liệu PDF với khổ giấy A5
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });
    
    // Thiết lập font chữ
    doc.setFont("helvetica");
    
    // Tạo tiêu đề hóa đơn
    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text("HÓA ĐƠN DỊCH VỤ", 74, 15, { align: 'center' });
    
    // Thêm thông tin rạp
    doc.setFontSize(12);
    doc.setTextColor(52, 152, 219);
    doc.text("CINEMA STAR", 74, 22, { align: 'center' });
    
    // Thông tin khách hàng và đơn hàng
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const yStart = 30;
    const lineHeight = 6;
    
    doc.text(`Khách hàng: ${this.ticketData.orderInfo.customerName}`, 15, yStart);
    doc.text(`Email: ${this.ticketData.orderInfo.email}`, 15, yStart + lineHeight);
    doc.text(`Ngày đặt: ${this.ticketData.orderInfo.formattedOrderDate}`, 15, yStart + lineHeight * 2);
    doc.text(`Mã đơn hàng: ${this.ticketData.orderInfo.orderCode}`, 15, yStart + lineHeight * 3);
    
    // Tạo bảng dịch vụ
    const tableData = this.ticketData.services.map(service => [
      service.serviceName,
      service.serviceType,
      service.quantity.toString(),
      service.formattedUnitPrice,
      service.formattedTotalPrice
    ]);
    
    // Thêm bảng vào PDF
    autoTable(doc, {
      startY: yStart + lineHeight * 5,
      head: [['Tên dịch vụ', 'Loại', 'SL', 'Đơn giá', 'Thành tiền']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [52, 152, 219],
        textColor: 255,
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30 },
        2: { cellWidth: 10, halign: 'center' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' }
      }
    });
    
    // Thêm tổng tiền
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Tổng tiền: ${this.ticketData.orderInfo.formattedTotalPrice}`, 133, finalY, { align: 'right' });
    
    // Thêm chân trang
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("Cảm ơn quý khách đã sử dụng dịch vụ!", 74, 140, { align: 'center' });
    
    // Tạo tên file
    const filename = `hoadon_${this.ticketData.orderInfo.orderCode}.pdf`;
    
    // Lưu hoặc mở PDF
    doc.save(filename);
  }
  
  // Thêm biến để hiển thị menu in
  showPrintOptions: boolean = false;

  // Phương thức bắt đầu đếm ngược
  startCountdown(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // Khởi tạo thời gian đếm ngược
    this.countdownTime = 5;
    
    // Xóa interval cũ nếu có
    this.clearTimers();
    
    // Cập nhật countdown mỗi giây
    this.countdownInterval = setInterval(() => {
      this.ngZone.run(() => {
        this.countdownTime--;
        
        // Cập nhật hiển thị cho người dùng
        const countdownElement = document.querySelector('.countdown');
        if (countdownElement) {
          countdownElement.textContent = this.countdownTime.toString();
        }
        
        // Dừng đếm ngược khi đếm đến 0
        if (this.countdownTime <= 0) {
          this.clearTimers();
        }
      });
    }, 1000);
    
    // Thiết lập timeout để reset scanner
    this.autoResetTimeout = setTimeout(() => {
      this.ngZone.run(() => {
        if (this.error) {
          this.resetScanner();
        }
      });
    }, 5000);
  }
  
  // Xóa interval và timeout đếm ngược
  clearTimers(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    if (this.autoResetTimeout) {
      clearTimeout(this.autoResetTimeout);
      this.autoResetTimeout = null;
    }
  }

  // Tách phương thức reset dữ liệu thành một hàm riêng để tái sử dụng
  resetAllData(): void {
    this.ticketData = null;
    this.scanResult = '';
    this.error = '';
    this.confirmSuccess = false;
    this.confirmMessage = '';
    this.isScanning = true;
    this.showPrintOptions = false;
  }
}