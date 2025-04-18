import { Component, OnInit, ViewChild, CUSTOM_ELEMENTS_SCHEMA, Inject, PLATFORM_ID, AfterViewInit, NgZone, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';

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
  
  scanResult: string = '';
  isScanning: boolean = true;
  ticketData: TicketResponse | null = null;
  error: string = '';
  isLoading: boolean = false;
  confirmSuccess: boolean = false;
  confirmMessage: string = '';
  
  // Danh sách các camera có sẵn
  availableCameras: CameraDevice[] = [];
  selectedCameraId: string = '';

  constructor(
    private http: HttpClient, 
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone
  ) {}

  // Thêm phương thức kiểm tra môi trường cho template
  isPlatformBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    console.log('QRcodeComponent initialized');
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
  }
  
  async initQrScanner(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    
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
      this.error = 'Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.';
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
    this.http.get<TicketResponse>(`${this.API_URL}/GetTicketInfo/${orderCode}`)
      .subscribe({
        next: (response) => {
          this.ticketData = response;
          this.isLoading = false;
        },
        error: (error) => {
          this.error = `Lỗi khi lấy thông tin vé: ${error.message}`;
          this.isLoading = false;
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
    this.ticketData = null;
    this.scanResult = '';
    this.error = '';
    this.confirmSuccess = false;
    this.confirmMessage = '';
    this.isScanning = true;
    
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
      this.ticketData = null;
      this.scanResult = '';
      this.error = '';
      this.confirmSuccess = false;
      this.confirmMessage = '';
      this.isScanning = true;
      
      // Khởi động lại quy trình
      setTimeout(() => {
        this.ngZone.run(() => {
          this.initQrScanner();
        });
      }, 500);
    }
  }

  printTickets(): void {
    window.print();
  }
}
