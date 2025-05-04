import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ServiceApiService } from '../../../services/service-api.service';
import { TicketService } from '../../../services/ticket.service';
import { AuthService } from '../../../services/auth.service';
import { WebsocketService, SeatStatusUpdateRequest } from '../../../services/websocket.service';
import { PdfGenerationService } from '../../../services/pdf-generation.service';
import { TicketPdfComponent } from '../../common/ticket-pdf/ticket-pdf.component';

// Định nghĩa interface cho thông tin ghế
interface SeatInfo {
  id: string;
  SeatStatusByShowTimeId: string;
  SeatName: string;
  RowName: string;
  SeatTypeName: string;
  SeatPrice: number;
  status: number; // 1: available, 2: selecting, 3: selected, 4: booked, 5: reserved
}

// Định nghĩa interface cho Service (sản phẩm)
interface Service {
  id: string;
  serviceTypeID: string;
  imageUrl: string;
  serviceName: string;
  description: string;
  price: number;
  status: number;
  count: number; // Số lượng khi thanh toán
  quantity?: number; // Số lượng khi thanh toán
}

// Định nghĩa interface cho ServiceType (loại sản phẩm)
interface ServiceType {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  serviceList: Service[];
}

// Interface cho API response
interface ApiResponse<T> {
  responseCode: number;
  message: string;
  data: T;
  totalRecord?: number;
}

// Interface cho Order data
interface OrderData {
  seats: SeatInfo[];
  services: Service[];
  totalAmount: number;
  showTimeId: string;
  userId: string;
}

@Component({
  selector: 'app-food-selection',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, RouterModule, TicketPdfComponent],
  templateUrl: './food-selection.component.html',
  styleUrls: ['./food-selection.component.css']
})
export class FoodSelectionComponent implements OnInit, OnDestroy {
  // Lưu trữ thông tin ghế để in vé sau khi thanh toán
  seatsToPrint: any[] = [];
  
  // Chế độ test
  isTestMode = false;
  
  // Biến điều khiển tiến trình
  currentStep = 1; // Bước hiện tại (1: chọn dịch vụ, 2: nhập thông tin, 3: thanh toán)
  
  // Thông tin từ bước chọn ghế
  showtimeId: string = '';
  selectedSeats: SeatInfo[] = [];
  seatsTotalPrice: number = 0;
  
  // Thông tin dịch vụ
  services: Service[] = [];
  filteredServices: Service[] = [];
  serviceTypes: ServiceType[] = [];
  selectedType: string | null = null;
  searchText: string = '';
  
  // Giỏ hàng
  cartItems: Service[] = [];
  selectedServices: Service[] = [];
  
  // Thông tin UI
  loading: boolean = false;
  error: string | null = null;
  currentPage: number = 1;
  recordsPerPage: number = 20;
  totalRecords: number = 0;
  
  // Payment modal
  showPaymentModal: boolean = false;
  paymentMethods: any[] = [
    {
      id: 1,
      name: 'Tiền mặt',
      icon: 'fa-money-bill-wave',
      description: 'Thanh toán bằng tiền mặt tại quầy'
    },
    {
      id: 2,
      name: 'Chuyển khoản/QR',
      icon: 'fa-qrcode',
      description: 'Quét mã QR để chuyển khoản thanh toán'
    }
  ];
  selectedPaymentMethod: any = null;
  
  // QR code
  showQRCode: boolean = false;
  qrImageUrl: string = 'assets/Image/sample-qr.png';
  orderId: string = '';
  paymentStatus: string = 'pending';
  
  // Receipt
  showPrintingOverlay: boolean = false;
  isPrinting: boolean = false;
  isLoading: boolean = false;
  today: Date = new Date();
  showtimeDetail: any = null;
  
  // PDF related properties
  showtimeInfoForPdf: any = {};
  orderInfoForPdf: any = {};
  apiResponseData: any = null; // Lưu trữ dữ liệu API nguyên bản
  orderDetail: any = {}; // Thông tin chi tiết về đơn hàng
  
  // Email khách hàng
  customerEmail: string = '';
  useDefaultEmail: boolean = true; // Mặc định dùng email guest
  defaultEmail: string = 'guest@cinema.com';
  isCheckingEmail: boolean = false;
  emailError: string = '';
  emailSuccess: string = '';
  customerInfo: any = null; // Lưu thông tin khách hàng nếu tìm thấy
  
  // Thêm thuộc tính cho thanh toán tiền mặt
  showCashPaymentModal: boolean = false;
  showReceiptModal: boolean = false;
  cashReceived: number = 0;
  changeAmount: number = 0;
  receiptItems: any[] = []; // Lưu danh sách mặt hàng cho hóa đơn
  receiptTotalAmount: number = 0; // Lưu tổng tiền cho hóa đơn
  receiptContent: string = '';
  
  // Lưu trữ logo dạng base64 cho in hóa đơn
  logoBase64: string = '';
  
  // Custom notification properties
  showCustomNotification = false;
  notificationType = '';
  notificationTitle = '';
  notificationMessage = '';
  notificationTimeout: any = null;
  
  private subscriptions: Subscription = new Subscription();
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private serviceApi: ServiceApiService,
    private ticketService: TicketService,
    private authService: AuthService,
    private pdfService: PdfGenerationService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.showtimeId = params['showtimeId'];
      this.loadSelectedSeats();
      this.loadServiceTypes();
    });
    
    // Chuyển đổi logo thành base64 cho việc in hóa đơn
    this.convertLogoToBase64();
    
    // Cập nhật thởi gian mỗi phút
    setInterval(() => {
      this.today = new Date();
    }, 60000);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
  
  // Lấy thông tin ghế đã chọn từ localStorage
  private loadSelectedSeats(): void {
    const savedSeats = localStorage.getItem('selectedSeats');
    if (savedSeats) {
      try {
        this.selectedSeats = JSON.parse(savedSeats);
        this.calculateSeatsTotalPrice();
      } catch (e) {
        console.error('Lỗi khi đọc dữ liệu ghế từ localStorage:', e);
        this.selectedSeats = [];
        this.seatsTotalPrice = 0;
      }
    }
  }
  
  // Tính tổng tiền ghế
  private calculateSeatsTotalPrice(): void {
    this.seatsTotalPrice = this.selectedSeats.reduce((total, seat) => total + seat.SeatPrice, 0);
  }
  
  // Tải danh sách loại dịch vụ
  loadServiceTypes(): void {
    this.loading = true;
    this.error = null;
    
    const apiUrl = 'https://localhost:7263';
    
    this.http.get<ApiResponse<ServiceType[]>>(`${apiUrl}/api/Service/GetServiceTypeList?currentPage=${this.currentPage}&recordPerPage=${this.recordsPerPage}`)
      .subscribe({
        next: (response) => {
          if (response.responseCode === 200) {
            this.serviceTypes = response.data;
            this.totalRecords = response.totalRecord || 0;
            
            // Lấy tất cả dịch vụ từ tất cả danh mục
            this.services = [];
            response.data.forEach(type => {
              if (type.serviceList && type.serviceList.length > 0) {
                this.services = [...this.services, ...type.serviceList];
              }
            });
            
            this.applyFilters();
          } else {
            this.error = response.message || 'Đã xảy ra lỗi khi tải dữ liệu';
            this.serviceTypes = [];
            this.services = [];
            this.filteredServices = [];
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Lỗi khi tải loại dịch vụ:', error);
          this.error = 'Không thể tải dữ liệu. Vui lòng thử lại sau.';
          this.loading = false;
        }
      });
  }
  
  // Chuyển đổi logo thành base64
  private convertLogoToBase64(): void {
    // Đặt logo mặc định là base64 cố định để đảm bảo luôn có logo
    this.logoBase64 = 'data:image/png;base64,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'


    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    // Sử dụng đường dẫn tuyệt đối
    const baseUrl = window.location.origin;
    const logoUrl = baseUrl + '/assets/Image/cinexLogo.png';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        this.logoBase64 = canvas.toDataURL('image/png');
        console.log('Logo đã được chuyển đổi sang base64 thành công');
      } else {
        console.error('Không thể tạo context cho canvas');
      }
    };
    
    img.onerror = (e) => {
      console.error('Lỗi khi tải logo:', e);
      // Đã có logo mặc định, không làm gì thêm
    };
    
    img.src = logoUrl;
    console.log('Đang tải logo từ:', logoUrl);
  }
  
  // Kiểm tra email khách hàng
  checkCustomerEmail(email: string): void {
    if (!email || email.trim() === '') {
      this.emailError = 'Vui lòng nhập email';
      return;
    }
    
    this.isCheckingEmail = true;
    this.emailError = '';
    this.emailSuccess = '';
    this.customerInfo = null;
    
    // Sử dụng phương thức đã tạo trong ticketService
    this.ticketService.getUserByEmail(email)
      .subscribe({
        next: (response) => {
          if (response.responseCode === 200 && response.user) {
            this.customerInfo = response.user;
            this.emailSuccess = 'Đã tìm thấy thông tin khách hàng';
          } else {
            this.emailError = 'Email không đúng hoặc chưa được tạo tài khoản. Vui lòng nhập email đúng hoặc tạo tài khoản trước';
          }
          this.isCheckingEmail = false;
        },
        error: (error) => {
          console.error('Lỗi khi kiểm tra email:', error);
          this.emailError = 'Không thể kiểm tra email. Vui lòng thử lại sau.';
          this.isCheckingEmail = false;
        }
      });
  }
  
  // Xử lý khi nhập email
  handleEmailInput(email: string): void {
    this.customerEmail = email;
    this.checkCustomerEmail(email);
  }
  
  // Áp dụng bộ lọc
  applyFilters(): void {
    let result = [...this.services];

    // Lọc theo loại
    if (this.selectedType !== null) {
      result = result.filter(service => service.serviceTypeID === this.selectedType);
    }

    // Lọc theo tìm kiếm
    if (this.searchText.trim()) {
      const term = this.searchText.toLowerCase().trim();
      result = result.filter(service => 
        service.serviceName.toLowerCase().includes(term) || 
        service.description?.toLowerCase().includes(term)
      );
    }

    this.filteredServices = result;
  }
  
  // Chọn loại dịch vụ
  selectType(typeId: string | null): void {
    this.selectedType = typeId;
    this.applyFilters();
  }
  
  // Tìm kiếm
  search(event: any): void {
    this.searchText = event.target.value;
    this.applyFilters();
  }
  
  // Lấy tên loại dịch vụ đã chọn
  getSelectedTypeName(): string {
    if (this.selectedType) {
      const type = this.serviceTypes.find(t => t.id === this.selectedType);
      return type ? type.name : '';
    }
    return '';
  }
  
  // Thêm dịch vụ vào giỏ hàng
  addToCart(service: Service): void {
    // Kiểm tra xem dịch vụ đã có trong giỏ hàng chưa
    const existingItem = this.cartItems.find(item => item.id === service.id);
    
    if (existingItem) {
      // Nếu đã có, tăng số lượng
      existingItem.count = (existingItem.count || 1) + 1;
    } else {
      // Nếu chưa có, thêm vào giỏ hàng với số lượng 1
      const serviceToAdd = { ...service, count: 1 };
      this.cartItems.push(serviceToAdd);
    }
    
    // Hiển thị thông báo bằng alert
    console.log(`Đã thêm ${service.serviceName} vào giỏ hàng!`);
    // Có thể hiển thị thông báo bằng alert nếu cần
    // alert(`Đã thêm ${service.serviceName} vào giỏ hàng!`);
  }
  
  // Xóa dịch vụ khỏi giỏ hàng
  removeFromCart(index: number): void {
    if (index >= 0 && index < this.cartItems.length) {
      const item = this.cartItems[index];
      if (item.count && item.count > 1) {
        // Nếu số lượng > 1, giảm số lượng
        item.count--;
      } else {
        // Nếu số lượng = 1, xóa khỏi giỏ hàng
        this.cartItems.splice(index, 1);
      }
    }
  }
  
  // Xóa tất cả dịch vụ khỏi giỏ hàng
  clearCart(): void {
    this.cartItems = [];
  }
  
  // Tính tổng tiền dịch vụ
  getServicesTotalPrice(): number {
    return this.cartItems.reduce((total, item) => total + item.price * (item.count || 1), 0);
  }
  
  // Tính tổng tiền (ghế + dịch vụ)
  getTotalPrice(): number {
    return this.seatsTotalPrice + this.getServicesTotalPrice();
  }
  
  // Format giá tiền
  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }
  
  // Quay lại bước chọn ghế
  goBack(): void {
    // We don't want to clear selected seats when going back to seat selection
    // The seats should still be selected in the seat map
    this.router.navigate(['/trangchu/seat-map', this.showtimeId]);
  }
  
  // Mở modal thanh toán
  openPaymentModal(): void {
    // Kiểm tra đã chọn ghế chưa
    if (!this.selectedSeats || this.selectedSeats.length === 0) {
      this.showNotification('Bạn chưa chọn ghế nào!', 'warning');
      return;
    }
    
    // Kiểm tra email khách hàng nếu không sử dụng email mặc định
    if (!this.useDefaultEmail) {
      // Nếu không có email hoặc email trống
      if (!this.customerEmail || this.customerEmail.trim() === '') {
        this.showNotification('Vui lòng nhập email khách hàng!', 'warning');
        return;
      }
      
      // Nếu có lỗi email hoặc chưa xác thực thành công (customerInfo null)
      if (this.emailError || !this.customerInfo) {
        this.showNotification('Email không hợp lệ hoặc chưa được xác thực. Vui lòng kiểm tra lại email trước khi tiếp tục!', 'error');
        return;
      }
    }
    
    // Nếu mọi điều kiện đều thỏa mãn, hiển thị modal thanh toán
    this.showPaymentModal = true;
  }
  
  // Đóng modal thanh toán
  closePaymentModal(): void {
    this.showPaymentModal = false;
  }
  
  // Chọn phương thức thanh toán
  selectPaymentMethod(method: any): void {
    this.selectedPaymentMethod = method;
    this.showPaymentModal = false;
    
    if (method.id === 1) {
      // Thanh toán tiền mặt - Mở modal nhập tiền
      this.openCashPaymentModal();
    } else if (method.id === 2) {
      // Thanh toán QR
      this.processPaymentQR();
    }
  }
  
  // Mở modal nhập tiền khách thanh toán
  openCashPaymentModal(): void {
    this.showCashPaymentModal = true;
    this.cashReceived = 0;
    this.calculateChange();
  }
  
  // Đóng modal nhập tiền
  closeCashPaymentModal(): void {
    this.showCashPaymentModal = false;
  }
  
  // Tính tiền thừa
  calculateChange(): void {
    const previousChange = this.changeAmount;
    this.changeAmount = this.cashReceived - this.getTotalPrice();
    
    // Chỉ hiển thị thông báo nếu số tiền thay đổi từ âm -> dương (không đủ -> đủ/thừa)
    if (previousChange < 0 && this.changeAmount >= 0) {
      this.showNotification(`Số tiền hợp lệ. Tiền thừa: ${this.formatPrice(this.changeAmount)}`, 'success');
    }
  }
  
  // Đặt số tiền nhanh
  setQuickAmount(amount: number): void {
    this.cashReceived = amount;
    this.calculateChange();
    
    // Hiển thị thông báo thân thiện khi số tiền đã đủ/thừa
    const diff = this.cashReceived - this.getTotalPrice();
    if (diff >= 0) {
      this.showNotification(`Số tiền thừa: ${this.formatPrice(diff)}`, 'info');
    }
  }
  
  // Xử lý thanh toán tiền mặt
  processCashPayment(): void {
    if (this.cashReceived < this.getTotalPrice()) {
      this.showNotification('Tiền khách đưa không đủ để thanh toán. Vui lòng kiểm tra lại số tiền.', 'error');
      return;
    }
    
    // Đóng modal tiền mặt
    this.closeCashPaymentModal();
    
    // Hiển thị loading trong khi xử lý
    this.isLoading = true;
    
    // Lưu thông tin để hiển thị trên hóa đơn
    this.receiptItems = [...this.cartItems];
    this.receiptTotalAmount = this.getTotalPrice();
    
    // Lấy thông tin người dùng đang đăng nhập
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.showNotification('Lỗi xác thực: Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.', 'error');
      this.isLoading = false;
      return;
    }
    
    console.log('Current user for payment:', currentUser);
    console.log('Using showtimeId for payment:', this.showtimeId);
    
    // Chuẩn bị dữ liệu để tạo đơn hàng theo đúng cấu trúc API yêu cầu
    const orderData = {
      email: this.useDefaultEmail ? this.defaultEmail : this.customerEmail, // Sử dụng email thực tế hoặc email mặc định
      userId: currentUser.id,
      isAnonymous: this.useDefaultEmail, // Chỉ là anonymous nếu dùng email mặc định
      showTimeId: this.showtimeId,
      selectedSeats: this.selectedSeats.map(seat => ({
        seatByShowTimeId: seat.SeatStatusByShowTimeId
      })),
      selectedServices: this.cartItems.map(service => ({
        serviceId: service.id,
        quantity: service.count || 1
      }))
    };
    
    // Log chi tiết dữ liệu
    console.log('Selected seats data:', this.selectedSeats);
    console.log('Order data to send:', orderData);
    
    // Gọi API tạo đơn hàng
    this.ticketService.createTicketAndServiceOrder(orderData)
      .subscribe(
        response => {
          if (response.responseCode === 200 && response.orderCode) {
            console.log('Order created successfully with code:', response.orderCode);
            const orderCode = response.orderCode;
            
            // Lưu showtimeId vào localStorage để tiến hành cập nhật trạng thái ghế sau này
            if (this.showtimeId) {
              console.log('Saving currentShowTimeId to localStorage:', this.showtimeId);
              localStorage.setItem('currentShowTimeId', this.showtimeId);
            }
            
            // Sau khi tạo đơn hàng thành công, gọi API thanh toán
            this.ticketService.confirmTicketAndServicePayment(orderCode, currentUser.id)
              .subscribe(
                paymentResponse => {
                  // Đảm bảo tắt loading trước khi hiển thị thông báo thành công
                  this.isLoading = false;
                  
                  if (paymentResponse.responseCode === 200) {
                    console.log('Payment processed successfully');
                    
                    // Lưu thông tin email đã sử dụng để hiển thị trên hóa đơn
                    localStorage.setItem('lastOrderEmail', this.useDefaultEmail ? this.defaultEmail : this.customerEmail);
                    
                    // Lưu mã đơn hàng để hiển thị trên hóa đơn
                    this.orderId = orderCode;
                    
                    // GỌI TRỰC TIẾP ACTION PAYMENT QUA WEBSOCKET
                    console.log('Directly calling Payment WebSocket action');
                    
                    // Lấy websocketService từ ticketService
                    const websocketService = this.ticketService.getWebsocketService();
                    
                    // Tạo danh sách ghế cần cập nhật status = 5 (BOOKED)
                    const seatUpdates: SeatStatusUpdateRequest[] = this.selectedSeats.map(seat => ({
                      SeatId: seat.SeatStatusByShowTimeId,
                      Status: 5 // BOOKED
                    }));
                    
                    // Gọi trực tiếp action Payment
                    websocketService.payment(seatUpdates);
                    console.log('Payment WebSocket action called with data:', seatUpdates);
                    
                    // Gọi thêm GetList để cập nhật lại UI
                    setTimeout(() => {
                      websocketService.getList();
                    }, 800);
                    
                    // Hiển thị thông báo thành công trước khi mở hóa đơn
                    this.showNotification('Đặt vé thành công! Cảm ơn quý khách đã sử dụng dịch vụ.', 'success');
                    
                    // Lưu thông tin ghế để in vé trước khi xóa
                    this.seatsToPrint = [...this.selectedSeats];
                    console.log('Đã lưu ghế để in vé:', this.seatsToPrint);
                    
                    // Xoá giỏ hàng và thông tin ghế sau khi thanh toán thành công
                    this.clearCartAndSeats();
                    
                    // Hiển thị hóa đơn sau khi thông báo thành công ngắn
                    setTimeout(() => {
                      this.openReceiptModal();
                    }, 1500); // Đợi 1.5 giây để người dùng thấy thông báo thành công
                  } else {
                    console.error('Payment failed with code:', paymentResponse.responseCode);
                    const friendlyMessage = this.getFriendlyErrorMessage(paymentResponse.message);
                    this.showNotification(`Thanh toán không thành công: ${friendlyMessage}`, 'error');
                  }
                },
                error => {
                  this.isLoading = false;
                  console.error('Payment API error:', error);
                  this.showNotification('Không thể kết nối đến máy chủ thanh toán. Vui lòng thử lại sau.', 'error');
                }
              );
          } else {
            this.isLoading = false;
            console.error('Order creation failed with code:', response.responseCode);
            const friendlyMessage = this.getFriendlyErrorMessage(response.message);
            this.showNotification(`Tạo đơn hàng không thành công: ${friendlyMessage}`, 'error');
          }
        },
        error => {
          this.isLoading = false;
          console.error('Order API error:', error);
          alert('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
        }
      );
  }
  
  // Mở modal hiển thị hóa đơn
  openReceiptModal(): void {
    this.showReceiptModal = true;
    this.prepareReceiptContent();
  }
  
  // Đóng modal hóa đơn
  closeReceiptModal(): void {
    this.showReceiptModal = false;
    
    // Chuyển hướng về trang chính sau khi đóng hóa đơn
    setTimeout(() => {
      this.router.navigate(['/trangchu/ticket/now']);
    }, 500);
  }
  
  // Chuẩn bị nội dung hóa đơn
  prepareReceiptContent(): void {
    // Lấy thông tin cần thiết để tạo hóa đơn
    const currentUser = this.authService.getCurrentUser();
    const staffName = currentUser ? currentUser.userName : 'Nhân viên';
    
    // Mã đơn hàng
    const orderCode = this.orderId || `ORD-${new Date().getTime()}`;
    
    // Tính tổng tiền từ vé và dịch vụ
    const seatsTotalPrice = this.seatsTotalPrice;
    const serviceTotal = this.getServicesTotalPrice();
    const totalAmount = seatsTotalPrice + serviceTotal;
    
    // Tạo nội dung hóa đơn
    this.receiptContent = `
      <html>
        <head>
          <title>Hóa đơn thanh toán</title>
          <style>
            body { 
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
              background-color: #f9f9f9;
            }
            .receipt { 
              max-width: 80mm;
              margin: 0 auto;
              background: #eeeeee;
              padding: 15px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              border-radius: 5px;
            }
            .logo {
              text-align: center;
              margin-bottom: 10px;
              background-color: #e0e0e0;
              padding: 10px;
              border-radius: 5px;
              border-bottom: 1px solid #d0d0d0;
            }
            .logo img {
              max-width: 100px;
              height: auto;
            }
            .header { 
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 1px dashed #ccc;
            }
            .header h1 {
              margin: 10px 0;
              font-size: 18px;
            }
            .header p {
              margin: 5px 0;
              font-size: 12px;
              color: #666;
            }
            .section-title {
              font-weight: bold; 
              margin: 15px 0 5px 0;
              border-bottom: 1px solid #eee;
              padding-bottom: 5px;
              font-size: 14px;
            }
            .seats-section {
              margin-bottom: 15px;
              font-size: 12px;
            }
            .seat-info {
              padding: 5px 0;
              border-bottom: 1px dotted #eee;
              display: flex;
              justify-content: space-between;
            }
            .details { 
              margin-bottom: 20px;
              font-size: 12px;
            }
            .table { 
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .table th, .table td { 
              padding: 8px 4px;
              text-align: left;
              border-bottom: 1px solid #eee;
            }
            .table th {
              font-weight: bold;
            }
            .table td {
              border-bottom: 1px solid #f5f5f5;
            }
            .table .amount {
              text-align: right;
            }
            .total { 
              text-align: right;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px dashed #ccc;
              font-weight: bold;
              font-size: 14px;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
              padding-top: 10px;
              border-top: 1px dashed #ccc;
            }
            .barcode {
              text-align: center;
              margin: 15px 0;
              font-family: monospace;
              font-size: 12px;
            }
            @media print {
              body {
                background: none;
                padding: 0;
              }
              .receipt {
                box-shadow: none;
                max-width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="logo">
              <img src="data:image/png;base64,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'


            <div class="header">
              <h1>HÓA ĐƠN THANH TOÁN</h1>
              <p>Mã đơn hàng: ${orderCode}</p>
              <p>Ngày: ${this.formatLocalDate(this.today)}</p>
              <p>Nhân viên: ${staffName}</p>
            </div>
            
            <div class="section-title">THÔNG TIN VÉ</div>
            <div class="seats-section">
              ${this.selectedSeats.length > 0 ? 
                this.selectedSeats.map(seat => `
                  <div class="seat-info">
                    <span>Ghế: ${seat.SeatName}</span>
                    <span>${this.formatPrice(seat.SeatPrice)}</span>
                  </div>
                `).join('') : 
                '<p>Không có vé được chọn</p>'
              }
              <div class="seat-info" style="font-weight: bold;">
                <span>Tổng tiền ghế:</span>
                <span>${this.formatPrice(seatsTotalPrice)}</span>
              </div>
            </div>
            
            <div class="section-title">THÔNG TIN DỊCH VỤ</div>
            <div class="details">
              <table class="table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th class="amount">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.cartItems.map(item => `
                    <tr>
                      <td>${item.serviceName}</td>
                      <td>${item.count || 1}</td>
                      <td>${this.formatPrice(item.price)}</td>
                      <td class="amount">${this.formatPrice((item.count || 1) * item.price)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div class="total">
              <p>Tổng tiền ghế: ${this.formatPrice(seatsTotalPrice)}</p>
              <p>Tổng tiền dịch vụ: ${this.formatPrice(serviceTotal)}</p>
              <p>Tổng cộng: ${this.formatPrice(totalAmount)}</p>
            </div>
            
            <div class="barcode">
              <div style="text-align: center; font-size: 22px; letter-spacing: 5px; font-family: monospace; color: #333;">|||||||||||</div>
              <div class="barcode-text">* ${orderCode} *</div>
            </div>
            
            <div class="footer">
              <p>Cảm ơn quý khách đã sử dụng dịch vụ!</p>
              <p>Chúc quý khách xem phim vui vẻ</p>
            </div>
          </div>
          <script>
            window.onload = function() { 
              window.print(); 
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;
  }
  
  // Tạo nội dung vé cho mỗi ghế
  prepareTicketContent(seat: SeatInfo): string {
    // Lấy thông tin cần thiết để tạo hóa đơn
    const currentUser = this.authService.getCurrentUser();
    const staffName = currentUser ? currentUser.userName : 'Nhân viên';
    
    // Mã đơn hàng
    const orderCode = this.orderId || `ORD-${new Date().getTime()}-${seat.RowName}${seat.SeatName}`;
    
    // Lấy thông tin phim và suất chiếu
    const showtime = this.showtimeDetail || { startTime: new Date().toISOString() };
    const movieTitle = showtime.movieTitle || 'Chưa xác định';
    
    // Tạo nội dung vé
    return `
      <html>
        <head>
          <title>Vé Chiếu Phim - ${seat.RowName}${seat.SeatName}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
              background-color: #f9f9f9;
              font-size: 14px;
            }
            .ticket { 
              width: 80mm;
              max-width: 100%;
              margin: 0 auto;
              background: #fff;
              padding: 20px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              border-radius: 10px;
              position: relative;
              overflow: hidden;
            }
            .ticket:before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              width: 6px;
              height: 100%;
              background: #3498db;
              border-top-left-radius: 10px;
              border-bottom-left-radius: 10px;
            }
            .logo {
              text-align: center;
              margin-bottom: 15px;
              padding-bottom: 15px;
              border-bottom: 1px dashed #eee;
            }
            .header { 
              text-align: center;
              margin-bottom: 20px;
              color: #3498db;
            }
            .header h1 {
              margin: 0 0 5px 0;
              font-size: 24px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .ticket-info {
              margin-bottom: 20px;
              font-size: 13px;
            }
            .movie-title {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 10px;
              text-align: center;
              padding: 10px;
              background: #f9f9f9;
              border-radius: 5px;
              color: #333;
            }
            .seat-info {
              text-align: center;
              margin: 15px 0;
              background: #3498db;
              color: white;
              padding: 10px;
              border-radius: 5px;
              font-size: 18px;
              font-weight: bold;
              letter-spacing: 1px;
            }
            .details { 
              margin-bottom: 15px;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              padding-bottom: 8px;
              border-bottom: 1px dotted #eee;
            }
            .detail-label {
              font-weight: 500;
              color: #666;
            }
            .detail-value {
              font-weight: 600;
              text-align: right;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #999;
              padding-top: 15px;
              border-top: 1px dashed #eee;
            }
            .barcode {
              text-align: center;
              margin: 15px 0;
              padding: 10px 0;
            }
            .barcode-text {
              font-family: monospace;
              font-size: 12px;
              letter-spacing: 2px;
              text-align: center;
            }
            @media print {
              body {
                background: none;
                padding: 0;
                margin: 0;
              }
              .ticket {
                box-shadow: none;
                border: none;
                padding: 15px;
                width: 100%;
                max-width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="logo">
              <div style="font-size: 24px; font-weight: bold; color: #3498db;">CINEX</div>
              <div style="font-size: 12px; color: #555;">Cinema Experience</div>
            </div>
            
            <div class="header">
              <h1>VÉ XEM PHIM</h1>
            </div>
            
            <div class="movie-title">${movieTitle}</div>
            
            <div class="seat-info">
              GHẾ: ${seat.RowName}${seat.SeatName}
            </div>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">Ngày chiếu:</span>
                <span class="detail-value">${this.formatLocalDate(new Date(showtime.startTime))}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Suất chiếu:</span>
                <span class="detail-value">${this.formatTime(new Date(showtime.startTime))}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Rạp:</span>
                <span class="detail-value">${showtime.cinemaName || 'CINEX Cinema'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Phòng:</span>
                <span class="detail-value">${showtime.roomName || '-'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Loại ghế:</span>
                <span class="detail-value">${seat.SeatTypeName || 'Thường'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Giá vé:</span>
                <span class="detail-value">${this.formatCurrency(seat.SeatPrice || 0)} ₫</span>
              </div>
            </div>
            
            <div class="barcode">
              <div style="text-align: center; font-size: 22px; letter-spacing: 5px; font-family: monospace; color: #333;">|||||||||||</div>
              <div class="barcode-text">* ${orderCode} *</div>
            </div>
            
            <div class="footer">
              <p>Vui lòng đến trước giờ chiếu 15 phút</p>
              <p>Cảm ơn quý khách đã sử dụng dịch vụ!</p>
              <p>Chúc quý khách xem phim vui vẻ</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
  
  // Tạo nội dung hóa đơn dịch vụ
  prepareServiceContent(): string {
    // Kiểm tra nếu không có dịch vụ nào
    if (!this.selectedServices || this.selectedServices.length === 0) {
      return '';
    }
    
    // Lấy thông tin cần thiết để tạo hóa đơn
    const currentUser = this.authService.getCurrentUser();
    const staffName = currentUser ? currentUser.userName : 'Nhân viên';
    
    // Mã đơn hàng
    const orderCode = this.orderId || `ORD-${new Date().getTime()}-SV`;
    
    // Tính tổng tiền dịch vụ
    const serviceTotal = this.getServicesTotalPrice();
    
    // Tạo nội dung dịch vụ
    const servicesHtml = this.selectedServices.map(service => `
      <tr>
        <td>${service.serviceName}</td>
        <td class="quantity">${service.quantity || 1}</td>
        <td class="price">${this.formatCurrency(service.price || 0)} ₫</td>
        <td class="amount">${this.formatCurrency((service.price || 0) * (service.quantity || 1))} ₫</td>
      </tr>
    `).join('');
    
    return `
      <html>
        <head>
          <title>Hóa Đơn Dịch Vụ</title>
          <style>
            body { 
              font-family: 'Segoe UI', Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
              background-color: #f9f9f9;
              font-size: 14px;
            }
            .receipt { 
              width: 80mm;
              max-width: 100%;
              margin: 0 auto;
              background: #fff;
              padding: 20px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              border-radius: 10px;
              position: relative;
              overflow: hidden;
            }
            .receipt:before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              width: 6px;
              height: 100%;
              background: #e67e22;
              border-top-left-radius: 10px;
              border-bottom-left-radius: 10px;
            }
            .logo {
              text-align: center;
              margin-bottom: 15px;
              padding-bottom: 15px;
              border-bottom: 1px dashed #eee;
            }
            .header { 
              text-align: center;
              margin-bottom: 20px;
              color: #e67e22;
            }
            .header h1 {
              margin: 0 0 5px 0;
              font-size: 24px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .info {
              margin-bottom: 15px;
              font-size: 13px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .section-title {
              font-size: 14px;
              font-weight: 700;
              margin: 15px 0 10px 0;
              text-transform: uppercase;
              padding-bottom: 5px;
              border-bottom: 1px solid #eee;
              color: #e67e22;
            }
            .table { 
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .table th, .table td { 
              padding: 8px 5px;
              text-align: left;
              font-size: 13px;
            }
            .table th {
              border-bottom: 2px solid #eee;
              font-weight: 600;
              color: #666;
            }
            .table td {
              border-bottom: 1px solid #f5f5f5;
            }
            .table .quantity, .table .price, .table .amount {
              text-align: right;
            }
            .table tr:last-child td {
              border-bottom: none;
            }
            .totals {
              margin-top: 15px;
              font-size: 14px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              padding-bottom: 5px;
              border-bottom: 1px dotted #eee;
            }
            .total-row:last-child {
              border-bottom: 2px solid #e67e22;
              border-top: 2px solid #e67e22;
              padding-top: 5px;
              margin-top: 10px;
              font-weight: 700;
              font-size: 16px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #999;
              padding-top: 15px;
              border-top: 1px dashed #eee;
            }
            .barcode {
              text-align: center;
              margin: 15px 0;
              padding: 10px 0;
            }
            .barcode-text {
              font-family: monospace;
              font-size: 12px;
              letter-spacing: 2px;
              text-align: center;
            }
            @media print {
              body {
                background: none;
                padding: 0;
                margin: 0;
              }
              .receipt {
                box-shadow: none;
                border: none;
                padding: 15px;
                width: 100%;
                max-width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="logo">
              <div style="font-size: 24px; font-weight: bold; color: #e67e22;">CINEX</div>
              <div style="font-size: 12px; color: #555;">Cinema Experience</div>
            </div>
            
            <div class="header">
              <h1>HÓA ĐƠN DỊCH VỤ</h1>
            </div>
            
            <div class="info">
              <div class="info-row">
                <span>Mã đơn hàng:</span>
                <span>${orderCode}</span>
              </div>
              <div class="info-row">
                <span>Ngày:</span>
                <span>${this.formatLocalDate(this.today)}</span>
              </div>
              <div class="info-row">
                <span>Nhân viên:</span>
                <span>${staffName}</span>
              </div>
            </div>
            
            <div class="section-title">THÔNG TIN DỊCH VỤ</div>
            
            <table class="table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th class="quantity">SL</th>
                  <th class="price">Đơn giá</th>
                  <th class="amount">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${servicesHtml}
              </tbody>
            </table>
            
            <div class="totals">
              <div class="total-row">
                <span>Tổng tiền dịch vụ:</span>
                <span>${this.formatCurrency(serviceTotal)} ₫</span>
              </div>
              <div class="total-row">
                <span>Tổng cộng:</span>
                <span>${this.formatCurrency(serviceTotal)} ₫</span>
              </div>
            </div>
            
            <div class="barcode">
              <div style="text-align: center; font-size: 22px; letter-spacing: 5px; font-family: monospace; color: #333;">|||||||||||</div>
              <div class="barcode-text">* ${orderCode} *</div>
            </div>
            
            <div class="footer">
              <p>Cảm ơn quý khách đã sử dụng dịch vụ!</p>
              <p>Chúc quý khách xem phim vui vẻ</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
  
  // Định dạng tiền tệ
  formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN');
  }
  
  // Định dạng giờ
  formatTime(date: Date): string {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  
  // Định dạng ngày
  formatLocalDate(date: Date): string {
    // Đảm bảo sử dụng thởi gian địa phương
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  }

  // Định dạng ngày giờ
  formatLocalDateTime(date: Date): string {
    // Đảm bảo sử dụng thởi gian địa phương
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  }
  
  // Tham chiếu đến component PDF ticket
  @ViewChild('ticketPdfContainer') ticketPdfContainer!: ElementRef;
  
  // Lấy tên nhân viên hiện tại để hiển thị trên hóa đơn
  getStaffName(): string {
    const currentUser = this.authService.getCurrentUser();
    return currentUser ? (currentUser.userName || currentUser.email || 'Nhân viên bán hàng') : 'Nhân viên bán hàng';
  }
  
  // Hàm này đã được thay thế bằng showSuccessNotification
  // để tránh lỗi duplicate function implementation
  
  // Chuyển đổi thông báo lỗi kỹ thuật thành thông báo thân thiện
  getFriendlyErrorMessage(technicalMessage: string): string {
    // Ánh xạ thông báo kỹ thuật sang thông báo thân thiện
    const errorMap: {[key: string]: string} = {
      'Invalid payment method': 'Phương thức thanh toán không hợp lệ.',
      'Order not found': 'Không tìm thấy thông tin đơn hàng.',
      'Payment failed': 'Thanh toán không thành công.',
      'Seat already booked': 'Ghế đã được đặt bởi người khác.',
      'Invalid seats': 'Thông tin ghế không hợp lệ.',
      'Invalid showtime': 'Suất chiếu không hợp lệ hoặc đã kết thúc.',
      'Invalid user': 'Người dùng không hợp lệ.',
      'Connection error': 'Lỗi kết nối mạng.',
      'Service not available': 'Dịch vụ tạm thởi không khả dụng.'
    };
    
    return errorMap[technicalMessage] || 'Có lỗi xảy ra. Vui lòng thử lại sau.';
  }
  
  // Xử lý thanh toán QR
  processPaymentQR(): void {
    this.isLoading = true;
    
    // Lấy thông tin người dùng đang đăng nhập
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      alert('Lỗi xác thực: Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.');
      this.isLoading = false;
      return;
    }
    
    // Chuẩn bị dữ liệu để tạo đơn hàng theo đúng cấu trúc API yêu cầu
    const orderData = {
      email: this.useDefaultEmail ? this.defaultEmail : this.customerEmail, // Sử dụng email thực tế hoặc email mặc định
      userId: currentUser.id,
      isAnonymous: this.useDefaultEmail, // Chỉ là anonymous nếu dùng email mặc định
      showTimeId: this.showtimeId,
      selectedSeats: this.selectedSeats.map(seat => ({
        seatByShowTimeId: seat.SeatStatusByShowTimeId
      })),
      selectedServices: this.cartItems.map(service => ({
        serviceId: service.id,
        quantity: service.count || 1
      }))
    };
    
    // Log chi tiết dữ liệu
    console.log('Selected seats data:', this.selectedSeats);
    console.log('Order data to send:', orderData);
    
    // Gọi API tạo đơn hàng
    this.ticketService.createTicketAndServiceOrder(orderData)
      .subscribe(
        response => {
          this.isLoading = false;
          if (response.responseCode === 200 && response.orderCode) {
            this.orderId = response.orderCode;
            this.showQRCode = true;
          } else {
            const friendlyMessage = this.getFriendlyErrorMessage(response.message);
            alert(`Tạo đơn hàng không thành công: ${friendlyMessage}`);
          }
        },
        error => {
          this.isLoading = false;
          console.error('Order API error:', error);
          alert('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
        }
      );
  }
  
  // Xác nhận thanh toán QR
  confirmPayment(): void {
    if (!this.orderId) {
      alert('Không tìm thấy mã đơn hàng');
      return;
    }
    
    this.isLoading = true;
    this.paymentStatus = 'pending';
    
    // Lấy thông tin người dùng đang đăng nhập
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      alert('Lỗi xác thực: Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.');
      this.isLoading = false;
      return;
    }
    
    console.log('Confirming payment for order:', this.orderId);
    
    // Gọi API thanh toán
    this.ticketService.confirmTicketAndServicePayment(this.orderId, currentUser.id)
      .subscribe(
        paymentResponse => {
          // Đảm bảo tắt loading trước khi hiển thị thông báo thành công
          this.isLoading = false;
          
          if (paymentResponse.responseCode === 200) {
            console.log('Payment processed successfully');
            this.paymentStatus = 'success';
            this.showQRCode = false;
            
            // GỌI TRỰC TIẾP ACTION PAYMENT QUA WEBSOCKET
            console.log('Directly calling Payment WebSocket action');
            
            // Lấy websocketService từ ticketService
            const websocketService = this.ticketService.getWebsocketService();
            
            // Tạo danh sách ghế cần cập nhật status = 5 (BOOKED)
            const seatUpdates: SeatStatusUpdateRequest[] = this.selectedSeats.map(seat => ({
              SeatId: seat.SeatStatusByShowTimeId,
              Status: 5 // BOOKED
            }));
            
            // Gọi trực tiếp action Payment
            websocketService.payment(seatUpdates);
            console.log('Payment WebSocket action called with data:', seatUpdates);
            
            // Gọi thêm GetList để cập nhật lại UI
            setTimeout(() => {
              websocketService.getList();
            }, 800);
            
            this.showSuccessNotification();
            this.clearCartAndSeats();
            
            // Chuyển hướng về trang chính
            setTimeout(() => {
              this.router.navigate(['/trangchu/ticket/now']);
            }, 2000);
          } else {
            console.error('Payment confirmation failed with code:', paymentResponse.responseCode);
            const friendlyMessage = this.getFriendlyErrorMessage(paymentResponse.message);
            alert(`Thanh toán không thành công: ${friendlyMessage}`);
          }
        },
        error => {
          this.isLoading = false;
          this.paymentStatus = 'failed';
          console.error('Payment confirmation API error:', error);
          alert('Lỗi kết nối: Không thể kết nối đến máy chủ thanh toán. Vui lòng thử lại sau.');
        }
      );
  }
  
  // Hiển thị thông báo thành công
  showSuccessNotification(): void {
    // Thay thế alert bằng thông báo đẹp hơn
    const successElement = document.createElement('div');
    successElement.className = 'success-notification';
    successElement.innerHTML = `
      <div class="success-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="success-message">
        <h3>Thanh toán thành công!</h3>
        <p>Đơn hàng của bạn đã được xử lý.</p>
      </div>
    `;
    
    // Style cho thông báo
    successElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: #4CAF50;
      color: white;
      padding: 15px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      z-index: 9999;
      animation: slideIn 0.5s ease-out;
    `;
    
    // Thêm style cho icon
    const icon = successElement.querySelector('.success-icon') as HTMLElement;
    if (icon) {
      icon.style.cssText = `
        font-size: 30px;
        margin-right: 15px;
      `;
    }
    
    // Thêm vào document
    document.body.appendChild(successElement);
    
    // Tự động xóa sau 2 giây
    setTimeout(() => {
      if (successElement.parentNode) {
        successElement.classList.add('fade-out');
        successElement.style.animation = 'fadeOut 0.5s ease-in forwards';
        setTimeout(() => {
          if (successElement.parentNode) {
            document.body.removeChild(successElement);
          }
        }, 500);
      }
    }, 2000);
  }
  
  // Xóa giỏ hàng và thông tin ghế đã chọn
  clearCartAndSeats(): void {
    this.cartItems = [];
    this.selectedSeats = [];
    localStorage.removeItem('selectedSeats');
    // Không xóa currentShowTimeId để tránh lỗi khi quay lại trang showtime
    // localStorage.removeItem('currentShowTimeId');
  }

  // Hiển thị chi tiết dịch vụ (đã không còn sử dụng)
  // Nhưng vẫn giữ lại để tránh lỗi
  viewServiceDetails(service: Service) {
    // Khi người dùng nhấp vào card, gọi phương thức addToCart
    this.addToCart(service);
  }
  
  // Hiển thị thông báo
  showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title: string = ''): void {
    // Đặt tiêu đề thông báo dựa trên loại
    switch (type) {
      case 'success':
        this.notificationTitle = title || 'Thành công';
        break;
      case 'error':
        this.notificationTitle = title || 'Lỗi';
        break;
      case 'warning':
        this.notificationTitle = title || 'Cảnh báo';
        break;
      default:
        this.notificationTitle = title || 'Thông tin';
    }
    
    // Đặt loại thông báo và nội dung
    this.notificationType = type;
    this.notificationMessage = message;
    
    // Hiển thị thông báo
    this.showCustomNotification = true;
    
    // Xóa timeout cũ nếu có
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    // Tự động đóng thông báo sau 5 giây
    this.notificationTimeout = setTimeout(() => {
      this.closeNotification();
    }, 5000);
    
    console.log(`Hiển thị thông báo: ${message}, loại: ${type}, tiêu đề: ${this.notificationTitle}`);
    
    // Gọi hàm thông báo trực tiếp để tương thích ngược
    this.showNotificationDirect(message, type, this.notificationTitle);
  }
  
  // Đóng thông báo
  closeNotification(): void {
    // Thêm class fade-out để tạo hiệu ứng biến mất
    const notificationElement = document.querySelector('.custom-notification');
    if (notificationElement) {
      notificationElement.classList.add('fade-out');
      
      // Đợi animation kết thúc rồi mới ẩn thông báo
      setTimeout(() => {
        this.showCustomNotification = false;
        notificationElement.classList.remove('fade-out');
      }, 300);
    } else {
      this.showCustomNotification = false;
    }
  }
  
  // Hàm hiển thị thông báo trực tiếp (giục đị ngoài)
  private showNotificationDirect(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title: string = ''): void {
    // Xóa thông báo cũ nếu có
    const oldNotifications = document.querySelectorAll('.custom-notification');
    oldNotifications.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    
    // Tạo phần tử thông báo
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}-notification`;
    
    // Thêm inline styles để đảm bảo hiển thị
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.minWidth = '300px';
    notification.style.maxWidth = '450px';
    notification.style.backgroundColor = 'white';
    notification.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
    notification.style.borderRadius = '8px';
    notification.style.padding = '16px';
    notification.style.display = 'flex';
    notification.style.alignItems = 'flex-start';
    notification.style.zIndex = '9999';
    notification.style.overflowX = 'hidden';
    
    if (type === 'success') {
      notification.style.borderLeft = '4px solid #4caf50';
    } else if (type === 'error') {
      notification.style.borderLeft = '4px solid #f44336';
    } else if (type === 'warning') {
      notification.style.borderLeft = '4px solid #ff9800';
    } else {
      notification.style.borderLeft = '4px solid #2196f3';
    }
    
    // Chọn icon phù hợp với loại thông báo
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    // Tạo nội dung HTML cho thông báo
    notification.innerHTML = `
      <div class="notification-icon" style="margin-right: 15px; font-size: 20px;">
        <i class="fas fa-${icon}" style="color: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'}"></i>
      </div>
      <div class="notification-content" style="flex: 1;">
        ${title ? `<h4 style="margin: 0 0 5px 0; font-size: 16px; font-weight: 600;">${title}</h4>` : ''}
        <p style="margin: 0; font-size: 14px; line-height: 1.4;">${message}</p>
      </div>
      <div class="notification-close" style="margin-left: 10px; color: #777; cursor: pointer; font-size: 16px;">
        <i class="fas fa-times"></i>
      </div>
    `;
    
    // Thêm thông báo vào body
    document.body.appendChild(notification);
    
    // Thêm sự kiện click cho nút đóng
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.removeNotification(notification);
      });
    }
    
    // Hiển thị notification
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transition = 'opacity 0.3s ease-in-out';
    }, 10);
    
    // Tự động ẩn sau 5 giây
    setTimeout(() => {
      this.removeNotification(notification);
    }, 5000);
  }
  
  // Xóa thông báo
  removeNotification(notification: HTMLElement): void {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }

  // In hóa đơn/vé dước dạng PDF
  printReceipt(): void {
    this.isLoading = true;
    
    // Kiểm tra xem có mã đơn hàng chưa
    if (this.orderId) {
      // Sử dụng API mới để lấy thông tin đầy đủ về đơn hàng và vé
      this.http.get<any>(`https://localhost:7263/api/Counter/Order/GetDetails/${this.orderId}`).subscribe(
        (response) => {
          if (response && response.responseCode === 200) {
            console.log('Lấy thông tin chi tiết đơn hàng thành công:', response);
            
            // Chuẩn bị dữ liệu từ API mới
            this.prepareDataFromApi(response);
            
            // Tạo PDF với dữ liệu đã chuẩn bị
            this.createPDFWithData();
          } else {
            console.error('Lỗi khi lấy thông tin đơn hàng:', response?.message || 'Phản hồi không hợp lệ');
            // Thử phương thức dự phòng
            this.fallbackGetShowtimeDetails();
          }
        },
        (error) => {
          console.error('Lỗi khi gọi API lấy thông tin đơn hàng:', error);
          // Thử phương thức dự phòng
          this.fallbackGetShowtimeDetails();
        }
      );
    } else if (this.showtimeId) {
      // Nếu không có orderId nhưng có showtimeId, thử sử dụng phương thức cũ
      this.fallbackGetShowtimeDetails();
    } else {
      // Nếu không có cả showtimeId và orderId, tạo PDF với dữ liệu hiện có
      this.createPDFWithData();
    }
  }

  // Phương thức dự phòng sử dụng API cũ để lấy thông tin
  private fallbackGetShowtimeDetails(): void {
    // Lấy thông tin chi tiết về suất chiếu
    this.http.get<any>(`https://localhost:7263/api/Counter/GetShowtimeDetails/${this.showtimeId}`).subscribe(
      (response) => {
        if (response && response.responseCode === 200) {
          console.log('Lấy dữ liệu showtime chi tiết từ API cũ:', response.data);
          this.showtimeDetail = {
            ...this.showtimeDetail,
            ...response.data,
          };
          
          // Nếu có orderId, tiếp tục lấy thông tin order
          if (this.orderId) {
            this.http.get<any>(`https://localhost:7263/api/Counter/GetOrderDetails/${this.orderId}`).subscribe(
              (orderResponse) => {
                if (orderResponse && orderResponse.responseCode === 200) {
                  console.log('Lấy dữ liệu đơn hàng chi tiết từ API cũ:', orderResponse.data);
                  this.orderDetail = orderResponse.data;
                  
                  // Cập nhật thông tin suất chiếu nếu có
                  if (orderResponse.data && orderResponse.data.showtime) {
                    const showtime = orderResponse.data.showtime;
                    this.showtimeDetail = {
                      ...this.showtimeDetail,
                      movie: showtime.data.movie || {},
                      movieTitle: showtime.data.movie?.title,
                      roomName: showtime.data.room?.name || showtime.data.roomName,
                      cinemaName: showtime.data.cinema?.name || showtime.data.cinemaName,
                      startTime: showtime.data.startTime || this.showtimeDetail?.startTime
                    };
                  }
                  this.createPDFWithData();
                }
              },
              (error) => {
                console.error('Lỗi khi lấy dữ liệu suất chiếu từ API cũ:', error);
                this.createPDFWithData();
              }
            );
          } else {
            this.createPDFWithData();
          }
        } else {
          this.createPDFWithData();
        }
      },
      (error) => {
        console.error('Lỗi khi lấy thông tin đơn hàng từ API cũ:', error);
        this.createPDFWithData();
      }
    );
  }

  // Chuẩn bị dữ liệu từ API mới
  private prepareDataFromApi(apiResponse: any): void {
    // Kiểm tra dữ liệu đầu vào
    if (!apiResponse) {
      console.error('Dữ liệu API không hợp lệ');
      return;
    }

    // Lưu trữ đầy đủ phản hồi API để tham khảo
    this.apiResponseData = apiResponse;

    // Lấy thông tin đơn hàng
    const orderInfo = apiResponse.orderInfo || {};
    // Lấy thông tin phim và suất chiếu
    const movieShowtime = apiResponse.movieShowtimeInfo || {};
    // Lấy danh sách ghế
    const seats = apiResponse.seatDetails || [];
    // Lấy danh sách dịch vụ
    const services = apiResponse.serviceDetails || [];

    // Cập nhật thông tin showtimeDetail
    this.showtimeDetail = {
      ...this.showtimeDetail, // Giữ lại thông tin hiện có
      movie: {
        title: movieShowtime.movieName,
        description: movieShowtime.movieDescription,
        duration: movieShowtime.duration,
        thumbnail: movieShowtime.thumbnail,
        banner: movieShowtime.banner
      },
      movieTitle: movieShowtime.movieName,
      startTime: movieShowtime.showTimeInfo?.startTime,
      endTime: movieShowtime.showTimeInfo?.endTime,
      room: {
        name: movieShowtime.roomInfo?.roomName,
        type: movieShowtime.roomInfo?.roomType
      },
      roomName: movieShowtime.roomInfo?.roomName,
      cinema: {
        name: movieShowtime.cinemaInfo?.cinemaName,
        address: movieShowtime.cinemaInfo?.address
      },
      cinemaName: movieShowtime.cinemaInfo?.cinemaName,
      ageRating: movieShowtime.ageRatingCode
    };

    // Cập nhật thông tin đơn hàng
    this.orderDetail = {
      ...this.orderDetail, // Giữ lại thông tin hiện có
      orderId: orderInfo.orderId,
      orderCode: orderInfo.orderCode,
      totalPrice: orderInfo.totalPrice,
      createdDate: orderInfo.createdDate,
      status: orderInfo.status,
      email: orderInfo.email,
      discountPrice: orderInfo.discountPrice
    };

    // Cập nhật danh sách ghế từ API
    if (seats && seats.length > 0) {
      this.seatsToPrint = seats.map((seat: any) => ({
        id: seat.seatInfo.seatId,
        SeatName: seat.seatInfo.seatName,
        RowName: seat.seatInfo.rowNumber,
        SeatTypeName: seat.seatInfo.seatType,
        SeatPrice: seat.seatInfo.actualPrice,
        ticketCode: seat.ticketCode,
        status: seat.seatInfo.status
      }));
    }

    // Cập nhật danh sách dịch vụ từ API
    if (services && services.length > 0) {
      this.selectedServices = services.map((service: any) => ({
        id: service.serviceId,
        serviceName: service.serviceName,
        description: service.description,
        price: service.unitPrice,
        count: service.quantity,
        quantity: service.quantity,
        serviceTypeID: service.serviceType,
        totalPrice: service.totalPrice
      }));
    }

    console.log('Dữ liệu đã chuẩn bị từ API mới:', {
      showtimeDetail: this.showtimeDetail,
      orderDetail: this.orderDetail,
      seatsToPrint: this.seatsToPrint,
      selectedServices: this.selectedServices
    });
  }

  // Phương thức tạo PDF với dữ liệu đã có
  private createPDFWithData(): void {
    // Kiểm tra và log dữ liệu showtimeDetail để debug
    console.log('Dữ liệu chi tiết suất chiếu trước khi tạo PDF:', this.showtimeDetail);
    
    // Cập nhật thông tin cho PDF với dữ liệu hiện có - xử lý cẩn thận hơn các trường hợp null/undefined
    this.showtimeInfoForPdf = {
      // Sử dụng thứ tự ưu tiên rõ ràng khi lấy thông tin tên phim
      movieTitle: this.showtimeDetail?.movie?.title || 
                  this.showtimeDetail?.movieTitle || 
                  this.showtimeDetail?.movie?.name ||
                  'Thông tin đang cập nhật',
      
      // Định dạng ngày tháng từ startTime hoặc showtime.startTime
      showDate: this.formatShowDate(),
      
      // Định dạng thởi gian
      showTime: this.formatShowTime(),
      
      // Lấy thông tin rạp
      cinemaName: this.showtimeDetail?.cinema?.name || 
                  this.showtimeDetail?.cinemaName || 
                  'CINEX Cinema',
      
      // Lấy thông tin phòng chiếu
      roomName: this.showtimeDetail?.room?.name || 
                this.showtimeDetail?.roomName || 
                'Thông tin đang cập nhật'
    };
    
    // Thông tin đơn hàng cập nhật
    this.orderInfoForPdf = {
      orderId: this.orderId || `ORD-${new Date().getTime()}`,
      orderDate: this.formatLocalDate(this.today),
      staffName: this.getStaffName(),
      // Thêm tổng tiền (nếu cần)
      totalAmount: this.getTotalPrice ? this.getTotalPrice() : 0
    };
    
    // Log dữ liệu để debug
    console.log('Dữ liệu PDF đã chuẩn bị:', {
      showtimeInfoForPdf: this.showtimeInfoForPdf,
      orderInfoForPdf: this.orderInfoForPdf,
      selectedSeats: this.selectedSeats,
      seatsToPrint: this.seatsToPrint,
      selectedServices: this.selectedServices
    });
    
    // Tạo tên file PDF dựa trên mã đơn hàng
    const pdfFilename = `ticket_${this.orderId || 'order'}_${this.formatLocalDate(this.today).replace(/\//g, '')}.pdf`;
    
    // Sử dụng service để tạo PDF
    setTimeout(async () => {
      try {
        // Quyết định sử dụng ghế nào cho việc in - ưu tiên selectedSeats (ghế đang chọn) trước seatsToPrint (ghế đã lưu)
        const seatsToUse = this.selectedSeats.length > 0 ? this.selectedSeats : this.seatsToPrint;
        
        // Kiểm tra tính hợp lệ của dữ liệu ghế
        if (!seatsToUse || seatsToUse.length === 0) {
          console.warn('Không có thông tin ghế để in vé!');
          this.showNotificationDirect('Không có thông tin ghế để in vé. Vui lòng kiểm tra lại.', 'warning', 'Lỗi Xuất PDF');
          this.isLoading = false;
          return;
        }
        
        console.log('In vé cho các ghế:', seatsToUse);
        
        // Kiểm tra dữ liệu dịch vụ
        const servicesToUse = this.selectedServices || [];
        if (servicesToUse.length > 0) {
          console.log('Kèm theo các dịch vụ:', servicesToUse);
        }
        
        // Gọi service tạo PDF và lưu kết quả trả về
        const pdfDoc = await this.pdfService.generateTicketPdf(
          seatsToUse,
          servicesToUse,
          this.showtimeInfoForPdf,
          this.orderInfoForPdf
        );
        
        // Kiểm tra nếu PDF được tạo thành công
        if (pdfDoc) {
          // Lưu PDF xuống máy người dùng
          this.pdfService.downloadPdf(pdfDoc, pdfFilename);
          
          // Mở PDF trong tab mới
          this.pdfService.openPdfInNewTab(pdfDoc);
          
          this.showNotificationDirect('PDF đã được tạo và lưu thành công!', 'success', 'Xuất PDF');
        } else {
          this.showNotificationDirect('Không thể tạo PDF. Vui lòng thử lại sau.', 'error', 'Lỗi Xuất PDF');
        }
      } catch (error) {
        console.error('Lỗi khi tạo PDF:', error);
        this.showNotificationDirect('Lỗi khi tạo PDF. Vui lòng thử lại sau.', 'error', 'Lỗi Xuất PDF');
      } finally {
        this.isLoading = false;
      }
    }, 1000);
  }

  // Thêm các phương thức trợ giúp định dạng dữ liệu

  // Định dạng ngày chiếu
  private formatShowDate(): string {
    // Kiểm tra cả startTime và showDate
    if (this.showtimeDetail?.startTime) {
      return this.formatLocalDate(new Date(this.showtimeDetail.startTime));
    } else if (this.showtimeDetail?.showDate) {
      return this.showtimeDetail.showDate;
    } else {
      return this.formatLocalDate(new Date()); // Sử dụng ngày hiện tại nếu không có dữ liệu
    }
  }

  // Định dạng giờ chiếu
  private formatShowTime(): string {
    // Kiểm tra cả startTime và showTime
    if (this.showtimeDetail?.startTime) {
      const formattedDateTime = this.formatLocalDateTime(new Date(this.showtimeDetail.startTime));
      const timePart = formattedDateTime.split(' ')[0]; // Lấy phần giờ (10:30)
      return timePart;
    } else if (this.showtimeDetail?.showTime) {
      return this.showtimeDetail.showTime;
    } else {
      return this.formatTime(new Date()); // Sử dụng giờ hiện tại nếu không có dữ liệu
    }
  }

  // Xử lý khi PDF được tạo thành công
  onPdfGenerated(): void {
    this.showNotificationDirect('PDF đã được tạo thành công!', 'success', 'Xuất PDF');
  }
  
  // Xử lý khi có lỗi tạo PDF
  onPdfError(): void {
    this.showNotificationDirect('Lỗi khi tạo PDF. Vui lòng thử lại.', 'error', 'Lỗi xuất PDF');
  }

  // Xử lý lỗi khi ảnh không tải được
  handleImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/Image/cinexLogo.png';
  }

  // Lấy văn bản hiển thị trong quá trình loading
  getLoadingText(): string {
    return 'Đang xử lý dữ liệu, vui lòng đợi...';
  }
}
