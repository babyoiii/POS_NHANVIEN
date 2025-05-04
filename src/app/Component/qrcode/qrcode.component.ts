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
  serviceData?: any[]; // Thêm trường chứa dữ liệu dịch vụ từ localStorage
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
    if (!this.isPlatformBrowser() || this.isLoading) {
      return;
    }
    
    // Reset messages
    this.confirmSuccess = false;
    this.confirmMessage = '';
    this.error = '';
    
    // Set loading state
    this.isLoading = true;
    console.log(`Đang xác nhận vé với mã đơn hàng: ${orderCode}`);
    
    this.http.post<any>(`${this.API_URL}/ConfirmOrder?orderCode=${orderCode}`, {})
      .subscribe({
        next: (response) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            
            if (response && response.responseCode === 1) {
              // Cập nhật trạng thái xác nhận thành công
              this.confirmSuccess = true;
              this.confirmMessage = response.message || 'Xác nhận vé thành công!';
              console.log('Xác nhận vé thành công:', response);
              
              // Lấy thông tin vé để hiển thị và in
              this.getTicketInfo(orderCode);
              
              // QUAN TRỌNG: Lưu dấu hiệu là đang trong luồng thanh toán QR
              localStorage.setItem('isQRPaymentFlow', 'true');
              
              // Kiểm tra xem trong localStorage có dữ liệu dịch vụ không
              const serviceDataStr = localStorage.getItem('current_service_data');
              
              // Lưu thông tin vé vào localStorage trước khi reset
              if (this.ticketData) {
                // Tích hợp dữ liệu dịch vụ vào ticketData nếu có
                if (serviceDataStr) {
                  try {
                    // Đảm bảo parse đúng định dạng
                    const rawServiceData = JSON.parse(serviceDataStr);
                    console.log('Đã tìm thấy dữ liệu dịch vụ trong localStorage:', rawServiceData);
                    
                    // Chuyển đổi dữ liệu dịch vụ sang định dạng phù hợp với TicketResponse
                    const formattedServices = rawServiceData.map((service: any) => {
                      const unitPrice = service.price || 0;
                      const quantity = service.Quantity || service.quantity || 1;
                      const totalPrice = unitPrice * quantity;
                      
                      return {
                        orderServiceId: service.ServiceId || service.id || '',
                        serviceName: service.serviceName || 'Dịch vụ',
                        serviceType: service.serviceType || '',
                        quantity: quantity,
                        unitPrice: unitPrice,
                        formattedUnitPrice: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
                          .format(unitPrice)
                          .replace('₫', 'VND'),
                        totalPrice: totalPrice,
                        formattedTotalPrice: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
                          .format(totalPrice)
                          .replace('₫', 'VND'),
                        imageUrl: service.imageUrl || ''
                      };
                    });
                    
                    // Thiết lập services trực tiếp, không sử dụng serviceData nữa
                    this.ticketData.services = this.ticketData.services || [];
                    this.ticketData.services = [...this.ticketData.services, ...formattedServices];
                    console.log('Đã chuyển đổi dữ liệu dịch vụ thành định dạng chuẩn:', formattedServices);
                    
                    // Xóa dữ liệu dịch vụ khỏi localStorage sau khi đã xử lý thành công
                    localStorage.removeItem('current_service_data');
                    localStorage.removeItem('current_service_email');
                    localStorage.removeItem('service_timestamp');
                    console.log('Đã xóa dữ liệu dịch vụ khỏi localStorage sau khi xử lý thành công');
                  } catch (e) {
                    console.error('Lỗi khi xử lý dữ liệu dịch vụ:', e);
                  }
                }
                
                // Lưu dữ liệu đã tích hợp vào localStorage
                localStorage.setItem('lastTicketData', JSON.stringify(this.ticketData));
                
                // Tự động in vé sau 1 giây
                setTimeout(() => {
                  if (this.ticketData) {
                    this.printTicketsWithData(this.ticketData);
                    
                    // Hiển thị thông báo thành công
                    this.showSuccessMessage('Đã in vé thành công!');
                    console.log('Dữ liệu vé đã được lưu và in tự động');
                    
                    // Hiển thị tùy chọn in sau khi hoàn tất
                    this.showPrintOptions = true;
                    
                    // Sau khi in xong, chờ thêm 8 giây trước khi reset scanner
                    // để đảm bảo người dùng có đủ thời gian xem và in lại nếu cần
                    setTimeout(() => {
                      this.resetScanner();
                    }, 8000);
                  }
                }, 1000);
              }
            } else {
              // Xác nhận thất bại
              this.error = response?.message || 'Không thể xác nhận vé. Vui lòng thử lại.';
              console.error('Xác nhận vé thất bại:', response);
              
              // Bắt đầu đếm ngược để reset scanner
              this.startCountdown();
            }
          });
        },
        error: (error) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            this.error = 'Lỗi kết nối khi xác nhận vé. Vui lòng thử lại.';
            console.error('Lỗi khi xác nhận vé:', error);
            
            // Bắt đầu đếm ngược để reset scanner
            this.startCountdown();
          });
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
      currentY += lineHeight;
      
      // Thêm thông tin dịch vụ vào vé nếu có
      if (ticketData.services && ticketData.services.length > 0) {
        // Tiêu đề phần dịch vụ
        currentY += lineHeight/2;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(52, 152, 219);
        doc.text('DICH VU DI KEM', 15, currentY);
        currentY += lineHeight;
        
        // Reset font cho thông tin dịch vụ
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        // Hiển thị từng dịch vụ
        ticketData.services.forEach(service => {
          doc.text(`- ${service.serviceName} (${service.quantity}) x ${service.formattedUnitPrice}`, 15, currentY);
          currentY += lineHeight - 2; // Giảm khoảng cách giữa các dịch vụ
        });
        
        currentY += lineHeight/2; // Khoảng cách sau phần dịch vụ
      }
      
      currentY += lineHeight;
      
      // Thông tin chung - đặt trước QR code để tránh bị đè
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      
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
    
    // Tạo trang hóa đơn dịch vụ riêng nếu có dịch vụ hoặc dữ liệu dịch vụ từ localStorage
    if ((ticketData.services && ticketData.services.length > 0) || (ticketData.serviceData && ticketData.serviceData.length > 0)) {
      // Thêm trang mới cho hóa đơn dịch vụ
      doc.addPage('a6', 'portrait');
      
      // Tiêu đề hóa đơn
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('HOA DON THANH TOAN', 75, 15, { align: 'center' });
      
      // Thông tin đơn hàng
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      let currentY = 25;
      const lineHeight = 8;
      
      doc.text(`Ma don hang: ${ticketData.orderInfo.orderCode}`, 15, currentY);
      currentY += lineHeight;
      doc.text(`Ngay: ${ticketData.orderInfo.formattedOrderDate}`, 15, currentY);
      currentY += lineHeight;
      doc.text(`Nhan vien: ${ticketData.orderInfo.email || 'Counter Staff'}`, 15, currentY);
      currentY += lineHeight * 2;
      
      // Vẽ đường kẻ phân cách
      doc.setDrawColor(200, 200, 200);
      doc.line(15, currentY - 4, 90, currentY - 4);
      
      // Tiêu đề phần dịch vụ
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(52, 152, 219);
      doc.text('THONG TIN DICH VU', 15, currentY);
      currentY += lineHeight * 1.5;
      
      // Header table dịch vụ
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('San pham', 15, currentY);
      doc.text('SL', 60, currentY, { align: 'center' });
      doc.text('Don gia', 75, currentY, { align: 'center' });
      doc.text('Thanh tien', 95, currentY, { align: 'right' });
      currentY += lineHeight;
      
      // Vẽ đường kẻ phân cách
      doc.line(15, currentY - 4, 100, currentY - 4);
      
      // Hiển thị từng dịch vụ từ services
      if (ticketData.services && ticketData.services.length > 0) {
        ticketData.services.forEach(service => {
          // Thông tin dịch vụ
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(service.serviceName, 15, currentY, { maxWidth: 40 });
          doc.text(service.quantity.toString(), 60, currentY, { align: 'center' });
          doc.text(service.formattedUnitPrice, 75, currentY, { align: 'center' });
          doc.text(service.formattedTotalPrice, 95, currentY, { align: 'right' });
          currentY += lineHeight;
        });
      }
      
      // Hiển thị dịch vụ từ dữ liệu serviceData (lấy từ localStorage)
      if (ticketData.serviceData && ticketData.serviceData.length > 0) {
        ticketData.serviceData.forEach(service => {
          // Thông tin dịch vụ
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          
          // Lấy tên dịch vụ và số lượng
          const serviceName = service.ServiceId ? (service.serviceName || 'Dịch vụ') : 'Dịch vụ';
          const quantity = service.Quantity || service.quantity || 1;
          
          // Định dạng giá (nếu có)
          const unitPrice = service.price || 0;
          const totalPrice = unitPrice * quantity;
          
          const formattedUnitPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
            .format(unitPrice)
            .replace('₫', 'VND');
            
          const formattedTotalPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
            .format(totalPrice)
            .replace('₫', 'VND');
          
          // Hiển thị dịch vụ
          doc.text(serviceName, 15, currentY, { maxWidth: 40 });
          doc.text(quantity.toString(), 60, currentY, { align: 'center' });
          doc.text(formattedUnitPrice, 75, currentY, { align: 'center' });
          doc.text(formattedTotalPrice, 95, currentY, { align: 'right' });
          currentY += lineHeight;
        });
      }
      
      // Vẽ đường kẻ phân cách
      doc.line(15, currentY, 100, currentY);
      currentY += lineHeight;
      
      // Tổng tiền dịch vụ
      doc.setFont('helvetica', 'bold');
      doc.text('Tong tien dich vu:', 15, currentY);
      
      // Tính tổng tiền dịch vụ
      const totalServiceAmount = ticketData.services.reduce((total, service) => total + service.totalPrice, 0);
      const formattedTotalService = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
        .format(totalServiceAmount)
        .replace('₫', 'VND');
      
      doc.text(formattedTotalService, 95, currentY, { align: 'right' });
      currentY += lineHeight * 1.5;
      
      // Vẽ đường kẻ phân cách
      doc.line(15, currentY - 4, 100, currentY - 4);
      
      // Tổng cộng 
      doc.setFontSize(12);
      doc.text('Tong cong:', 15, currentY);
      doc.text(ticketData.orderInfo.formattedTotalPrice, 95, currentY, { align: 'right' });
      
      // Thêm mã đơn hàng vào cuối trang
      currentY = 120;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`* ${ticketData.orderInfo.orderCode} *`, 57, currentY, { align: 'center' });
      currentY += lineHeight;
      doc.text('Cam on quy khach da su dung dich vu', 57, currentY, { align: 'center' });
      currentY += lineHeight;
      doc.text('Chuc quy khach xem phim vui ve', 57, currentY, { align: 'center' });
    }
    
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
    if (!this.isPlatformBrowser()) {
      return;
    }
    
    console.log('Bắt đầu reset máy quét và dữ liệu...');
    
    // Kiểm tra xem có phải đang trong luồng thanh toán QR không
    const isQRPaymentFlow = localStorage.getItem('isQRPaymentFlow') === 'true';
    
    // Lấy dữ liệu vé từ localStorage nếu có
    const lastTicketDataStr = localStorage.getItem('lastTicketData');
    let lastTicketData: TicketResponse | null = null;
    
    if (lastTicketDataStr && isQRPaymentFlow) {
      try {
        lastTicketData = JSON.parse(lastTicketDataStr);
        console.log('Đã lấy dữ liệu vé từ localStorage:', lastTicketData?.orderInfo?.orderCode);
      } catch (e) {
        console.error('Lỗi khi lấy dữ liệu vé từ localStorage:', e);
      }
    }
    
    // Xóa timers
    this.clearTimers();
    
    // Dừng scanner hiện tại nếu đang quét
    if (this.html5QrCode) {
      if (this.html5QrCode.isScanning) {
        try {
          this.stopScanner();
          console.log('Scanner dừng thành công');
        } catch (err) {
          console.error('Lỗi khi dừng scanner:', err);
        }
      }
      
      // Giải phóng bộ nhớ để khởi tạo lại
      try {
        this.html5QrCode = null;
      } catch (err) {
        console.error('Lỗi khi xóa html5QrCode:', err);
      }
    }
    
    // Nếu đang trong luồng thanh toán QR và có dữ liệu trong localStorage
    if (isQRPaymentFlow && lastTicketData) {
      // Giữ lại dữ liệu dịch vụ
      this.scanResult = '';
      this.error = '';
      this.confirmSuccess = true;
      this.confirmMessage = 'Xác nhận vé thành công!';
      this.ticketData = lastTicketData;
      this.showPrintOptions = true;
      console.log('Giữ lại dữ liệu vé và dịch vụ từ luồng thanh toán QR');
      
      // Xóa cờ luồng thanh toán QR sau khi hoàn tất
      localStorage.removeItem('isQRPaymentFlow');
    } else {
      // Reset tất cả dữ liệu nếu không phải luồng QR hoặc không có dữ liệu
      this.scanResult = '';
      this.error = '';
      this.confirmSuccess = false;
      this.confirmMessage = '';
      this.ticketData = null;
      this.isScanning = true;
      this.showPrintOptions = false;
      
      // Xóa dữ liệu cũ trong localStorage nếu có
      localStorage.removeItem('lastTicketData');
    }
    
    // Đặt tiêu đề ngẫu nhiên mới
    this.setRandomTitle();
    
    // Khởi tạo lại quá trình quét
    setTimeout(() => {
      this.ngZone.run(() => {
        if (this.qrReaderRef && this.qrReaderRef.nativeElement) {
          // Tạo một container mới
          const oldContainer = this.qrReaderRef.nativeElement;
          const parent = oldContainer.parentNode;
          
          if (parent) {
            // Tạo element mới với cùng ID
            const newContainer = document.createElement('div');
            newContainer.id = oldContainer.id || 'qr-reader';
            newContainer.className = oldContainer.className || '';
            newContainer.style.width = '100%';
            newContainer.style.minHeight = '300px';
            
            // Thay thế element cũ
            parent.replaceChild(newContainer, oldContainer);
            this.qrReaderRef.nativeElement = newContainer;
            
            // Khởi tạo lại scanner
            try {
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
          }
        }
      });
    }, 300); // Chờ một khoảng thời gian ngắn trước khi khởi tạo lại
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
    // Xoá bất kỳ đếm ngược nào đang chạy
    this.clearTimers();
    
    // Thiết lập lại thời gian đếm ngược
    this.countdownTime = 5;
    
    // Bắt đầu đếm ngược
    this.countdownInterval = setInterval(() => {
      this.ngZone.run(() => {
        this.countdownTime--;
        
        // Cập nhật hiển thị đếm ngược trong giao diện
        const countdownElement = document.querySelector('.countdown');
        if (countdownElement) {
          countdownElement.textContent = this.countdownTime.toString();
        }
        
        // Khi đếm ngược đến 0, reset scanner
        if (this.countdownTime <= 0) {
          this.clearTimers();
          this.resetScanner();
        }
      });
    }, 1000);
    
    // Đặt thời gian hẹn auto reset sau 5 giây (phòng trường hợp interval bị hỏng)
    this.autoResetTimeout = setTimeout(() => {
      this.clearTimers();
      if (this.isScanning === false) {
        this.resetScanner();
      }
    }, 6000);
  }
  
  // Phương thức hiển thị thông báo thành công
  showSuccessMessage(message: string, duration: number = 3000): void {
    // Tạo một phần tử thông báo mới
    const messageElement = document.createElement('div');
    messageElement.className = 'success-message';
    messageElement.innerHTML = `
      <div class="success-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="message-content">${message}</div>
    `;
    
    // Style cho thông báo
    messageElement.style.position = 'fixed';
    messageElement.style.bottom = '20px';
    messageElement.style.left = '50%';
    messageElement.style.transform = 'translateX(-50%)';
    messageElement.style.background = 'rgba(76, 175, 80, 0.9)';
    messageElement.style.color = 'white';
    messageElement.style.padding = '15px 25px';
    messageElement.style.borderRadius = '5px';
    messageElement.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    messageElement.style.zIndex = '1000';
    messageElement.style.display = 'flex';
    messageElement.style.alignItems = 'center';
    messageElement.style.gap = '10px';
    messageElement.style.transition = 'all 0.3s ease';
    messageElement.style.opacity = '0';
    
    // Thêm vào body
    document.body.appendChild(messageElement);
    
    // Hiện dần
    setTimeout(() => {
      messageElement.style.opacity = '1';
    }, 10);
    
    // Tự động ẩn sau khoảng thời gian xác định
    setTimeout(() => {
      messageElement.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(messageElement)) {
          document.body.removeChild(messageElement);
        }
      }, 300);
    }, duration);
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