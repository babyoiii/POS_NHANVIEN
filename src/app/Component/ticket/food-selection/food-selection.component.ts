import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SeatInfo } from '../../../models/SeatModel';
import { Subscription } from 'rxjs';
import { ServiceApiService } from '../../../services/service-api.service';
import { TicketService } from '../../../services/ticket.service';
import { AuthService } from '../../../services/auth.service';
import { WebsocketService, SeatStatusUpdateRequest } from '../../../services/websocket.service';

// Định nghĩa interface cho Service (sản phẩm)
interface Service {
  id: string;
  serviceTypeID: string;
  imageUrl: string;
  serviceName: string;
  description: string;
  price: number;
  status: number;
  count?: number;
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
  imports: [CommonModule, HttpClientModule, FormsModule, RouterModule],
  templateUrl: './food-selection.component.html',
  styleUrls: ['./food-selection.component.css']
})
export class FoodSelectionComponent implements OnInit, OnDestroy {
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

  private subscriptions: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private serviceApi: ServiceApiService,
    private ticketService: TicketService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.showtimeId = params['showtimeId'];
      this.loadSelectedSeats();
      this.loadServiceTypes();
    });

    // Cập nhật thời gian hiện tại mỗi phút
    setInterval(() => {
      this.today = new Date();
    }, 60000);

    // Kiểm tra thanh toán QR thành công
    this.checkQRPaymentSuccess();

    // Lắng nghe sự kiện storage để phát hiện thanh toán QR thành công
    window.addEventListener('storage', this.handleStorageChange.bind(this));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();

    // Hủy đăng ký sự kiện storage
    window.removeEventListener('storage', this.handleStorageChange.bind(this));
  }

  // Kiểm tra thanh toán QR thành công
  checkQRPaymentSuccess(): void {
    try {
      const paymentSuccess = localStorage.getItem('payment_success');
      if (paymentSuccess === 'true') {
        console.log('Phát hiện thanh toán QR thành công khi khởi tạo component');

        // Lấy thông tin thanh toán từ localStorage
        const paymentOrderId = localStorage.getItem('payment_order_id');
        this.orderId = paymentOrderId || '';

        // Xử lý thanh toán thành công
        this.processSuccessfulPayment();

        // Xóa dữ liệu thanh toán khỏi localStorage
        localStorage.removeItem('payment_success');
        localStorage.removeItem('payment_order_id');
        localStorage.removeItem('payment_amount');
        localStorage.removeItem('payment_transaction_id');
        localStorage.removeItem('payment_code'); // Xóa thêm mã tham chiếu thanh toán
      }

      // Kiểm tra xem có cần mở modal hóa đơn không
      const openReceiptModal = localStorage.getItem('open_receipt_modal');
      if (openReceiptModal === 'true') {
        console.log('Phát hiện yêu cầu mở modal hóa đơn khi khởi tạo component');

        // Mở modal hóa đơn
        setTimeout(() => {
          this.openReceiptModal();

          // Xóa cờ để tránh mở lại modal khi refresh
          localStorage.removeItem('open_receipt_modal');
        }, 500); // Đợi một chút để đảm bảo component đã được khởi tạo đầy đủ
      }
    } catch (e) {
      console.error('Lỗi khi kiểm tra thanh toán QR:', e);
    }
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
      alert('Bạn chưa chọn ghế nào!');
      return;
    }

    // Kiểm tra email khách hàng nếu không sử dụng email mặc định
    if (!this.useDefaultEmail) {
      // Nếu không có email hoặc email trống
      if (!this.customerEmail || this.customerEmail.trim() === '') {
        alert('Vui lòng nhập email khách hàng!');
        return;
      }

      // Nếu có lỗi email hoặc chưa xác thực thành công (customerInfo null)
      if (this.emailError || !this.customerInfo) {
        alert('Email không hợp lệ hoặc chưa được xác thực. Vui lòng kiểm tra lại email trước khi tiếp tục!');
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
    this.changeAmount = this.cashReceived - this.getTotalPrice();
  }

  // Đặt số tiền nhanh
  setQuickAmount(amount: number): void {
    this.cashReceived = amount;
    this.calculateChange();
  }

  // Xử lý thanh toán tiền mặt
  processCashPayment(): void {
    if (this.cashReceived < this.getTotalPrice()) {
      alert('Tiền khách đưa không đủ');
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
      alert('Vui lòng đăng nhập lại');
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

                    // Hiển thị hóa đơn thay vì thông báo thành công
                    this.openReceiptModal();

                    // Xoá giỏ hàng và thông tin ghế sau khi thanh toán thành công
                    this.clearCartAndSeats();
                  } else {
                    console.error('Payment failed with code:', paymentResponse.responseCode);
                    alert('Lỗi khi thanh toán: ' + paymentResponse.message);
                  }
                },
                error => {
                  this.isLoading = false;
                  console.error('Payment API error:', error);
                  alert('Lỗi kết nối: ' + error.message);
                }
              );
          } else {
            this.isLoading = false;
            console.error('Order creation failed with code:', response.responseCode);
            alert('Lỗi khi tạo đơn hàng: ' + response.message);
          }
        },
        error => {
          this.isLoading = false;
          console.error('Order API error:', error);
          alert('Lỗi kết nối: ' + error.message);
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
            .table td.amount {
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
              <img src="assets/Image/cinexLogo.png" alt="Cinema Logo">
            </div>
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
              * ${orderCode} *
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

  // In hóa đơn
  printReceipt(): void {
    if (!this.receiptContent) {
      alert('Không có nội dung hóa đơn để in');
      return;
    }

    // Đánh dấu đang in
    this.isPrinting = true;

    // Mở cửa sổ in mới
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(this.receiptContent);
      printWindow.document.close();

      // Đặt hẹn giờ để tắt hiệu ứng loading sau khi in
      setTimeout(() => {
        this.isPrinting = false;
      }, 2000);
    } else {
      this.isPrinting = false;
      alert('Trình duyệt đã chặn cửa sổ popup. Vui lòng cho phép popup để in hóa đơn.');
    }
  }

  // Định dạng thời gian địa phương
  formatLocalDate(date: Date): string {
    // Đảm bảo sử dụng thời gian địa phương
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${hours}:${minutes} ${day}/${month}/${year}`;
  }

  // Lấy tên nhân viên
  getStaffName(): string {
    const currentUser = this.authService.getCurrentUser();
    // Sử dụng userName hoặc email nếu có, nếu không thì dùng giá trị mặc định
    return currentUser ? (currentUser.userName || currentUser.email || 'Nhân viên bán hàng') : 'Nhân viên bán hàng';
  }

  // Tạo mã tham chiếu ngẫu nhiên cho thanh toán QR
  generateRandomReference(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'cinex';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Xử lý thanh toán QR - phiên bản mới mở tab riêng
  processPaymentQR(): void {
    this.isLoading = true;
    console.log('Bắt đầu xử lý thanh toán QR (phương thức mới)');

    // Lấy thông tin người dùng đang đăng nhập
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      alert('Vui lòng đăng nhập lại');
      this.isLoading = false;
      return;
    }

    // Tạo mã tham chiếu thanh toán ngẫu nhiên
    const paymentReference = this.generateRandomReference();
    console.log('Đã tạo mã tham chiếu thanh toán:', paymentReference);

    // Tính tổng số tiền cần thanh toán
    const amount = this.getTotalPrice();
    console.log('Tổng số tiền cần thanh toán:', amount);

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
            console.log('Đã tạo đơn hàng thành công với mã:', this.orderId);

            // Mở tab mới với thông tin thanh toán QR
            const qrPaymentUrl = `/qr-payment?orderId=${encodeURIComponent(this.orderId)}&amount=${encodeURIComponent(amount)}&paymentCode=${encodeURIComponent(paymentReference)}`;
            console.log('URL thanh toán QR:', qrPaymentUrl);

            // Mở tab mới với URL có tham số
            window.open(qrPaymentUrl, '_blank');

            // Lắng nghe sự kiện storage để biết khi nào thanh toán thành công
            window.addEventListener('storage', this.handleStorageChange.bind(this));

            // Hiển thị thông báo
            // alert('Đã mở trang thanh toán QR trong tab mới. Vui lòng hoàn tất thanh toán.');
          } else {
            alert('Lỗi khi tạo đơn hàng: ' + response.message);
          }
        },
        error => {
          this.isLoading = false;
          alert('Lỗi kết nối: ' + error.message);
        }
      );
  }

  // Xử lý sự kiện storage change để phát hiện thanh toán thành công
  handleStorageChange(event: StorageEvent): void {
    console.log('Storage event detected:', event);

    if (event.key === 'payment_success' && event.newValue === 'true') {
      console.log('Phát hiện thanh toán thành công từ sự kiện storage');

      // Lấy thông tin thanh toán từ localStorage
      const paymentOrderId = localStorage.getItem('payment_order_id');
      const paymentCode = localStorage.getItem('payment_code'); // Lấy thêm mã tham chiếu thanh toán

      console.log('Thông tin thanh toán từ localStorage:', {
        paymentOrderId,
        orderId: this.orderId,
        paymentCode
      });

      // Kiểm tra xem có phải đơn hàng hiện tại không (kiểm tra cả orderId và paymentCode)
      if (paymentOrderId === this.orderId || (paymentCode && paymentCode === this.orderId)) {
        console.log('Xác nhận thanh toán thành công cho đơn hàng:', this.orderId);

        // Xử lý thanh toán thành công
        this.processSuccessfulPayment();

        // Xóa dữ liệu thanh toán khỏi localStorage
        localStorage.removeItem('payment_success');
        localStorage.removeItem('payment_order_id');
        localStorage.removeItem('payment_amount');
        localStorage.removeItem('payment_transaction_id');
        localStorage.removeItem('payment_code');
      }
    }

    // Kiểm tra xem có phải là sự kiện mở modal hóa đơn không
    if (event.key === 'open_receipt_modal' && event.newValue === 'true') {
      console.log('Phát hiện yêu cầu mở modal hóa đơn từ tab QR payment');

      // Mở modal hóa đơn
      this.openReceiptModal();

      // Xóa cờ để tránh mở lại modal khi refresh
      localStorage.removeItem('open_receipt_modal');
    }
  }

  // Xử lý khi thanh toán thành công
  processSuccessfulPayment(): void {
    console.log('Xử lý thanh toán thành công');

    // Lấy thông tin người dùng đang đăng nhập
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      alert('Vui lòng đăng nhập lại');
      return;
    }

    // Gọi API xác nhận thanh toán
    this.ticketService.confirmTicketAndServicePayment(this.orderId, currentUser.id)
      .subscribe(
        response => {
          if (response.responseCode === 200) {
            console.log('Payment confirmed successfully');

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

            // Hiển thị hóa đơn
            this.openReceiptModal();

            // Xoá giỏ hàng và thông tin ghế sau khi thanh toán thành công
            this.clearCartAndSeats();
          } else {
            console.error('Payment confirmation failed with code:', response.responseCode);
            alert('Lỗi khi thanh toán: ' + response.message);
          }
        },
        error => {
          console.error('Payment confirmation API error:', error);
          alert('Lỗi kết nối: ' + error.message);
        }
      );
  }

  // Xác nhận thanh toán QR - Phương thức này không còn được sử dụng trực tiếp
  // vì chúng ta đã chuyển sang cách xác nhận thanh toán qua tab mới
  confirmPayment(): void {
    console.log('Phương thức confirmPayment đã được thay thế bằng processSuccessfulPayment');

    // Đóng modal QR nếu đang hiển thị
    this.showQRCode = false;

    // Chuyển hướng sang phương thức mới
    if (this.orderId) {
      this.processSuccessfulPayment();
    } else {
      alert('Không tìm thấy mã đơn hàng');
    }
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

  // Xử lý lỗi hình ảnh
  handleImageError(event: any): void {
    event.target.src = 'assets/Image/cinexLogo.png';
  }
}
