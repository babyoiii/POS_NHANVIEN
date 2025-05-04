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
  showPrintOptions: boolean = false;
  
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
            this.error = 'Phiên đăng nhập đã hết hạn. Đang tự động thử lại...';
            
            // Khi lỗi xác thực 401, thử lại ngay lập tức sau 2 giây
            setTimeout(() => {
              // Reset scanner và scanner sẽ được khởi tạo lại trong phương thức
              this.resetScanner();
              
              // Hiển thị thông báo mới
              this.error = 'Scanner đã được khởi động lại, bạn có thể tiếp tục quét.';
              
              // Sau đó cũng tự động ẩn thông báo sau vài giây
              setTimeout(() => {
                if (this.error === 'Scanner đã được khởi động lại, bạn có thể tiếp tục quét.') {
                  this.error = '';
                }
              }, 3000);
              
              return; // Không cần dùng countdown
            }, 2000);
          } else if (error.status === 0) {
            this.error = 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.';
          } else if (error.status === 400) {
            this.error = 'Mã QR không hợp lệ. Vui lòng quét lại một mã QR vé hợp lệ.';
          } else {
            this.error = `Có lỗi xảy ra khi đọc thông tin vé. Vui lòng thử lại sau.`;
          }
          
          console.error('Chi tiết lỗi API:', error);
          
          // Bắt đầu đếm ngược để tự động reset scanner (chỉ khi không phải lỗi 401)
          if (error.status !== 401 && error.status !== 403) {
            this.startCountdown();
          }
          
          // Đảm bảo scanner vẫn hoạt động nếu bị dừng
          if (this.isScanning === false && this.html5QrCode && !this.html5QrCode.isScanning) {
            setTimeout(() => {
              this.startScanner();
            }, 1000);
          }
        }
      });
  }

  confirmTicket(orderCode: string): void {
    this.isLoading = true;
    this.confirmSuccess = false;
    this.confirmMessage = '';
    
    // Dừng scanner ngay lập tức để đảm bảo không có quét mới trong quá trình xác nhận
    if (this.html5QrCode && this.html5QrCode.isScanning) {
      this.stopScanner();
    }
    
    this.http.post<any>(`${this.API_URL}/ConfirmTicket/${orderCode}`, {})
      .subscribe({
        next: (response) => {
          // Cập nhật trạng thái xác nhận
          this.confirmSuccess = response.success;
          this.confirmMessage = response.message;
          this.isLoading = false;
          
          // Nếu xác nhận thành công
          if (response.success && this.ticketData) {
            console.log('Xác nhận vé thành công, chuẩn bị in vé...');
            
            // Tạo bản sao của dữ liệu vé để in (tránh mất dữ liệu nếu reset quá nhanh)
            const ticketDataCopy = JSON.parse(JSON.stringify(this.ticketData));
            
            // In vé ngay lập tức
            try {
              // Thực hiện in vé với bản sao dữ liệu
              this.printTicketsWithData(ticketDataCopy);
              console.log('In vé thành công');
            } catch (err) {
              console.error('Lỗi khi in vé:', err);
            }
            
            // Reset máy quét và dữ liệu ngay sau khi in
            this.ngZone.run(() => {
              console.log('Reset camera và dữ liệu...');
              this.resetScanner();
            });
          }
        },
        error: (error) => {
          this.error = `Lỗi khi xác nhận vé: ${error.message}`;
          this.isLoading = false;
          
          // Khởi động lại quét sau lỗi
          this.startScanner();
        }
      });
  }
  
  // Phương thức mới để in vé với dữ liệu được cung cấp từ bên ngoài
  printTicketsWithData(ticketData: TicketResponse): void {
    if (!ticketData || !ticketData.tickets || ticketData.tickets.length === 0) {
      console.log('Không có vé để in');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a6',
      putOnlyUsedFonts: true,
      floatPrecision: 16
    });
    
    // Thêm font hỗ trợ tiếng Việt
    doc.addFont('https://cdn.jsdelivr.net/npm/dejavu-sans@1.0.0/fonts/DejaVuSans.ttf', 'DejaVuSans', 'normal');
    doc.setFont('DejaVuSans');

    // Phương pháp thay thế để xử lý hiển thị tiếng Việt
    const originalTextFunction = doc.text.bind(doc);
    doc.text = function(text: string, x: number, y: number, options?: any) {
      // Bảo đảm text luôn là string
      const safeText = text.toString().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // Loại bỏ dấu
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
      return originalTextFunction(safeText, x, y, options);
    };

    // Duyệt qua từng vé và thêm vào trang riêng biệt
    ticketData.tickets.forEach((ticket, index) => {
      if (index > 0) {
        doc.addPage('a6', 'portrait');
      }

      // Logo và header
      if (ticket.movieThumbnail) {
        const img = new Image();
        img.src = ticket.movieThumbnail.startsWith('http') ? 
                  ticket.movieThumbnail : 
                  `https://localhost:7263/${ticket.movieThumbnail}`;
        
        try {
          doc.addImage(img, 'JPEG', 10, 10, 30, 40);
        } catch (error) {
          console.error('Lỗi khi thêm ảnh phim:', error);
        }
      }

      // Tiêu đề vé
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('VE XEM PHIM', 75, 15, { align: 'center' });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(52, 152, 219);
      doc.text(ticket.movieName, 75, 23, { align: 'center' });

      // Thông tin chi tiết vé
      const lineHeight = 8;
      let currentY = 55;

      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);

      doc.text(`Ma ve: ${ticket.ticketCode}`, 15, currentY);
      currentY += lineHeight;
      
      doc.text(`Rap: ${ticket.cinemaName}`, 15, currentY);
      currentY += lineHeight;
      
      doc.text(`Phong: ${ticket.roomName}`, 15, currentY);
      currentY += lineHeight;
      
      doc.text(`Ghe: ${ticket.seatName}`, 15, currentY);
      currentY += lineHeight;
      
      doc.text(`Thoi gian: ${ticket.formattedStartTime}`, 15, currentY);
      currentY += lineHeight;
      
      doc.text(`Thoi luong: ${ticket.formattedDuration}`, 15, currentY);
      currentY += lineHeight * 2;

      // Thông tin chung - đặt trước QR code để tránh bị đè
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      
      // Tăng khoảng cách giữa dòng cuối cùng và phần thông tin phía dưới
      currentY += 8;
      
      // Từ đồi sang 2 cột
      // Cột 1: QR code
      // QR Code (mô phỏng bằng hình vuông) - nhỏ hơn và đặt bên trái
      const qrSize = 25;
      const qrX = 15;
      
      // Cột 2: Thông tin
      // Đặt thông tin bên phải QR Code
      const infoX = qrX + qrSize + 10; // 10mm cách QR
      const textWidth = 95 - infoX; // Chiều rộng còn lại cho text
      
      doc.text('Vui long den truoc gio chieu', infoX, currentY + 5, { align: 'left', maxWidth: textWidth });
      doc.text('15-30 phut de on dinh cho ngoi', infoX, currentY + 10, { align: 'left', maxWidth: textWidth });
      doc.text('Ve da mua khong the doi hoac hoan tien', infoX, currentY + 15, { align: 'left', maxWidth: textWidth });
      doc.text(`Ma don hang: ${ticketData.orderInfo.orderCode || ''}`, infoX, currentY + 20, { align: 'left', maxWidth: textWidth });
    });
    
    // Tạo tên file
    const filename = `ve_${ticketData.orderInfo.orderCode}.pdf`;
    
    // Lưu PDF
    try {
      doc.save(filename);
    } catch (err) {
      console.error('Lỗi khi lưu PDF:', err);
    }
  }

  resetScanner(): void {
    // Xóa timers
    this.clearTimers();
    
    // Tạo biến để theo dõi trạng thái scanner
    let wasScanning = false;
    
    // Dừng scanner hiện tại nếu đang quét
    if (this.html5QrCode) {
      wasScanning = this.html5QrCode.isScanning;
      if (wasScanning) {
        try {
          this.stopScanner();
          console.log('Scanner dừng thành công');
        } catch (err) {
          console.error('Lỗi khi dừng scanner:', err);
          // Tiếp tục tiến trình ngay cả khi có lỗi
        }
      }
      
      // Giải phóng bộ nhớ để khởi tạo lại hoàn toàn
      try {
        this.html5QrCode = null;
      } catch (err) {
        console.error('Lỗi khi xóa html5QrCode:', err);
      }
    }
    
    // Reset tất cả dữ liệu
    this.resetAllData();
    
    // Xóa kết quả quét trước đó
    this.scanResult = '';
    
    // Đặt tiêu đề ngẫu nhiên mỗi khi reset scanner
    this.setRandomTitle();
    
    // Đặt trạng thái đang quét là true để cho phép khởi tạo mới
    this.isScanning = true;
    
    // Công khai log reset để tiện theo dõi
    console.log('Scanner và dữ liệu đã được reset hoàn toàn');
    
    if (isPlatformBrowser(this.platformId)) {
      // Khởi động lại scanner với thời gian chờ ngắn để tránh xung đột
      const timeout = wasScanning ? 800 : 300; // Chờ lâu hơn nếu scanner vừa bị dừng
      
      this.ngZone.run(() => {
        setTimeout(() => {
          try {
            // Tạo mới instance của scanner
            if (!this.html5QrCode) {
              console.log('Khởi tạo lại scanner...');
              this.initQrScanner();
            } else if (!this.html5QrCode.isScanning) {
              console.log('Khởi động lại quét...');
              this.startScanner();
            }
          } catch (err) {
            console.error('Lỗi khi khởi tạo lại scanner:', err);
            // Nếu có lỗi, thử lại sau 2 giây
            setTimeout(() => this.initQrScanner(), 2000);
          }
        }, timeout);
      });
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
    
    // Hiển thị tùy chọn in thay vì in trực tiếp
    this.showPrintOptions = true;
  }

  printAllTickets(): void {
    if (!this.ticketData || !this.ticketData.tickets || this.ticketData.tickets.length === 0) {
      console.log('Không có vé để in');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a6',
      putOnlyUsedFonts: true,
      floatPrecision: 16 // Tăng độ chính xác khi xử lý font
    });
    
    // Tạo font hỗ trợ tiếng Việt (sử dụng Helvetica hoặc Arial)
    doc.setFont('helvetica', 'normal');
    
    // Thêm font hỗ trợ tiếng Việt
    doc.addFont('https://cdn.jsdelivr.net/npm/dejavu-sans@1.0.0/fonts/DejaVuSans.ttf', 'DejaVuSans', 'normal');
    doc.setFont('DejaVuSans');

    // Phương pháp thay thế để xử lý hiển thị tiếng Việt
    const originalTextFunction = doc.text.bind(doc);
    doc.text = function(text: string, x: number, y: number, options?: any) {
      // Bảo đảm text luôn là string
      const safeText = text.toString().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // Loại bỏ dấu
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
      return originalTextFunction(safeText, x, y, options);
    };

    // Duyệt qua từng vé và thêm vào trang riêng biệt
    this.ticketData.tickets.forEach((ticket, index) => {
      if (index > 0) {
        doc.addPage('a6', 'portrait');
      }

      // Logo và header
      if (ticket.movieThumbnail) {
        const img = new Image();
        img.src = ticket.movieThumbnail.startsWith('http') ? 
                  ticket.movieThumbnail : 
                  `https://localhost:7263/${ticket.movieThumbnail}`;
        
        try {
          doc.addImage(img, 'JPEG', 10, 10, 30, 40);
        } catch (error) {
          console.error('Lỗi khi thêm ảnh phim:', error);
        }
      }

      // Tiêu đề vé
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('VÉ XEM PHIM', 75, 15, { align: 'center' });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(52, 152, 219);
      doc.text(ticket.movieName, 75, 23, { align: 'center' });

      // Thông tin vé
      const startY = ticket.movieThumbnail ? 55 : 30;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);

      // Vẽ khung cho thông tin vé
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(10, startY, 130, 60, 3, 3, 'FD');

      const lineHeight = 6;
      let currentY = startY + 8;

      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);

      // Thông tin chi tiết vé
      doc.text(`Mã vé: ${ticket.ticketCode}`, 15, currentY);
      currentY += lineHeight;
      
      doc.text(`Rạp: ${ticket.cinemaName}`, 15, currentY);
      currentY += lineHeight;
      
      doc.text(`Phòng: ${ticket.roomName}`, 15, currentY);
      currentY += lineHeight;
      
      doc.text(`Ghế: ${ticket.seatName}`, 15, currentY);
      currentY += lineHeight;
      
      doc.text(`Thời gian: ${ticket.formattedStartTime}`, 15, currentY);
      currentY += lineHeight;
      
      doc.text(`Thời lượng: ${ticket.formattedDuration}`, 15, currentY);
      currentY += lineHeight * 2;

      // QR Code (mô phỏng bằng hình vuông)
      doc.setFillColor(0, 0, 0);
      doc.roundedRect(60, currentY, 30, 30, 2, 2, 'F');
      
      currentY += 35;

      // Thông tin chung
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Vui lòng đến trước giờ chiếu 15-30 phút để ổn định chỗ ngồi', 75, currentY, { align: 'center' });
      currentY += lineHeight - 2;
      doc.text('Vé đã mua không thể đổi hoặc hoàn tiền', 75, currentY, { align: 'center' });
      currentY += lineHeight - 2;
      doc.text(`Mã đơn hàng: ${this.ticketData?.orderInfo?.orderCode || ''}`, 75, currentY, { align: 'center' });
    });

    // Tạo tên file
    const filename = `ve_${this.ticketData.orderInfo.orderCode}.pdf`;
    
    // Lưu PDF
    doc.save(filename);
  }

  printTicketAsPdf(ticket: Ticket): void {
    if (!this.isPlatformBrowser() || !this.ticketData) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a6',
      putOnlyUsedFonts: true,
      floatPrecision: 16 // Tăng độ chính xác khi xử lý font
    });
    
    // Thêm font hỗ trợ tiếng Việt
    doc.addFont('https://cdn.jsdelivr.net/npm/dejavu-sans@1.0.0/fonts/DejaVuSans.ttf', 'DejaVuSans', 'normal');
    doc.setFont('DejaVuSans');

    // Phương pháp thay thế để xử lý hiển thị tiếng Việt
    const originalTextFunction = doc.text.bind(doc);
    doc.text = function(text: string, x: number, y: number, options?: any) {
      // Bảo đảm text luôn là string
      const safeText = text.toString().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // Loại bỏ dấu
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
      return originalTextFunction(safeText, x, y, options);
    };

    // Logo và header
    if (ticket.movieThumbnail) {
      const img = new Image();
      img.src = ticket.movieThumbnail.startsWith('http') ? 
                ticket.movieThumbnail : 
                `https://localhost:7263/${ticket.movieThumbnail}`;
      
      try {
        doc.addImage(img, 'JPEG', 10, 10, 30, 40);
      } catch (error) {
        console.error('Lỗi khi thêm ảnh phim:', error);
      }
    }

    // Tiêu đề vé
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('VÉ XEM PHIM', 75, 15, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(52, 152, 219);
    doc.text(ticket.movieName, 75, 23, { align: 'center' });

    // Thông tin vé
    const startY = ticket.movieThumbnail ? 55 : 30;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);

    // Vẽ khung cho thông tin vé
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(10, startY, 130, 60, 3, 3, 'FD');

    const lineHeight = 6;
    let currentY = startY + 8;

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);

    // Thông tin chi tiết vé
    doc.text(`Mã vé: ${ticket.ticketCode}`, 15, currentY);
    currentY += lineHeight;
    
    doc.text(`Rạp: ${ticket.cinemaName}`, 15, currentY);
    currentY += lineHeight;
    
    doc.text(`Phòng: ${ticket.roomName}`, 15, currentY);
    currentY += lineHeight;
    
    doc.text(`Ghế: ${ticket.seatName}`, 15, currentY);
    currentY += lineHeight;
    
    doc.text(`Thời gian: ${ticket.formattedStartTime}`, 15, currentY);
    currentY += lineHeight;
    
    doc.text(`Thời lượng: ${ticket.formattedDuration}`, 15, currentY);
    currentY += lineHeight * 2;

    // QR Code (mô phỏng bằng hình vuông)
    doc.setFillColor(0, 0, 0);
    doc.roundedRect(60, currentY, 30, 30, 2, 2, 'F');
    
    currentY += 35;

    // Thông tin chung
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Vui lòng đến trước giờ chiếu 15-30 phút để ổn định chỗ ngồi', 75, currentY, { align: 'center' });
    currentY += lineHeight - 2;
    doc.text('Vé đã mua không thể đổi hoặc hoàn tiền', 75, currentY, { align: 'center' });
    currentY += lineHeight - 2;
    doc.text(`Mã đơn hàng: ${this.ticketData?.orderInfo?.orderCode || ''}`, 75, currentY, { align: 'center' });

    // Tạo tên file với mã vé
    const filename = `ve_${ticket.ticketCode}.pdf`;
    
    // Lưu file PDF
    doc.save(filename);
  }

  printServicesAsPdf(): void {
    if (!this.isPlatformBrowser() || !this.ticketData || !this.ticketData.services || this.ticketData.services.length === 0) {
      console.log('Không có dịch vụ để in');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Tiêu đề
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('HÓA ĐƠN DỊCH VỤ', 105, 15, { align: 'center' });
    
    // Thêm thông tin rạp
    doc.setFontSize(14);
    doc.setTextColor(52, 152, 219);
    doc.text("CINEMA STAR", 105, 22, { align: 'center' });
    
    // Thông tin khách hàng và đơn hàng
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    const yStart = 35;
    const lineHeight = 7;
    
    // Vẽ khung thông tin đơn hàng
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(15, yStart - 5, 180, lineHeight * 5, 3, 3, 'FD');
    
    doc.text(`Khách hàng: ${this.ticketData.orderInfo.customerName || 'Khách lẻ'}`, 20, yStart);
    doc.text(`Email: ${this.ticketData.orderInfo.email || 'Không có'}`, 20, yStart + lineHeight);
    doc.text(`Ngày đặt: ${this.ticketData.orderInfo.formattedOrderDate}`, 20, yStart + lineHeight * 2);
    doc.text(`Mã đơn hàng: ${this.ticketData.orderInfo.orderCode}`, 20, yStart + lineHeight * 3);
    
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
      theme: 'grid',
      headStyles: {
        fillColor: [52, 152, 219],
        textColor: 255,
        fontSize: 12,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 40 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      }
    });
    
    // Thêm tổng tiền
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Tổng tiền dịch vụ: ${this.ticketData.orderInfo.formattedTotalPrice}`, 180, finalY, { align: 'right' });
    
    // Thêm chân trang
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text("Cảm ơn quý khách đã sử dụng dịch vụ!", 105, 280, { align: 'center' });
    doc.text("Chúc quý khách xem phim vui vẻ", 105, 285, { align: 'center' });
    
    // Tạo tên file
    const filename = `dv_${this.ticketData.orderInfo.orderCode}.pdf`;
    
    // Lưu hoặc mở PDF
    doc.save(filename);
  }

  printOptions(): void {
    this.showPrintOptions = true;
  }

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
    // Reset dữ liệu quét
    this.scanResult = '';
    
    // Reset dữ liệu vé và trạng thái
    this.ticketData = null;
    this.error = '';
    this.confirmSuccess = false;
    this.confirmMessage = '';
    
    // Reset các tham số hệ thống
    this.countdownTime = 5;
    this.isScanning = true;
    this.showPrintOptions = false;
    
    // Đảm bảo không còn dữ liệu cũ trong cache
    if (this.http && (this.http as any).pendingRequests) {
      // Hủy các request đang chờ (nếu có)
      (this.http as any).pendingRequests.forEach((request: any) => {
        if (request && request.unsubscribe) {
          request.unsubscribe();
        }
      });
    }
    
    // Ghi log để theo dõi
    console.log('Tất cả dữ liệu và cache API đã được reset');
  }
}