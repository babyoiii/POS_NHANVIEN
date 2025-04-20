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
    this.router.navigate(['/trangchu/seat-map', this.showtimeId]);
  }
  
  // Mở modal thanh toán
  openPaymentModal(): void {
    if (!this.selectedSeats || this.selectedSeats.length === 0) {
      alert('Bạn chưa chọn ghế nào!');
      return;
    }
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
      // Thanh toán tiền mặt
      this.processPaymentCash();
    } else if (method.id === 2) {
      // Thanh toán QR
      this.processPaymentQR();
    }
  }
  
  // Xử lý thanh toán tiền mặt
  processPaymentCash(): void {
    this.isLoading = true;
    
    // Lấy thông tin người dùng đang đăng nhập
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      alert('Vui lòng đăng nhập lại');
      this.isLoading = false;
      return;
    }
    
    // Chuẩn bị dữ liệu để tạo đơn hàng theo đúng cấu trúc API yêu cầu
    const orderData = {
      email: "khachhang@example.com", // Email mặc định cho khách hàng tại quầy
      userId: currentUser.id,
      isAnonymous: true,
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
            const orderCode = response.orderCode;
            
            // Sau khi tạo đơn hàng thành công, gọi API thanh toán
            this.ticketService.confirmTicketAndServicePayment(orderCode, currentUser.id)
              .subscribe(
                paymentResponse => {
                  this.isLoading = false;
                  if (paymentResponse.responseCode === 200) {
                    this.showSuccessNotification();
                    this.clearCartAndSeats();
                    
                    // Chuyển hướng về trang chính
                    setTimeout(() => {
                      this.router.navigate(['/trangchu/ticket/now']);
                    }, 2000);
                  } else {
                    alert('Lỗi khi thanh toán: ' + paymentResponse.message);
                  }
                },
                error => {
                  this.isLoading = false;
                  alert('Lỗi kết nối: ' + error.message);
                }
              );
          } else {
            this.isLoading = false;
            alert('Lỗi khi tạo đơn hàng: ' + response.message);
          }
        },
        error => {
          this.isLoading = false;
          alert('Lỗi kết nối: ' + error.message);
        }
      );
  }
  
  // Xử lý thanh toán QR
  processPaymentQR(): void {
    this.isLoading = true;
    
    // Lấy thông tin người dùng đang đăng nhập
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      alert('Vui lòng đăng nhập lại');
      this.isLoading = false;
      return;
    }
    
    // Chuẩn bị dữ liệu để tạo đơn hàng theo đúng cấu trúc API yêu cầu
    const orderData = {
      email: "khachhang@example.com", // Email mặc định cho khách hàng tại quầy
      userId: currentUser.id,
      isAnonymous: true,
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
            alert('Lỗi khi tạo đơn hàng: ' + response.message);
          }
        },
        error => {
          this.isLoading = false;
          alert('Lỗi kết nối: ' + error.message);
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
      alert('Vui lòng đăng nhập lại');
      this.isLoading = false;
      return;
    }
    
    // Gọi API thanh toán
    this.ticketService.confirmTicketAndServicePayment(this.orderId, currentUser.id)
      .subscribe(
        response => {
          this.isLoading = false;
          if (response.responseCode === 200) {
            this.paymentStatus = 'success';
            this.showQRCode = false;
            this.showSuccessNotification();
            this.clearCartAndSeats();
            
            // Chuyển hướng về trang chính
            setTimeout(() => {
              this.router.navigate(['/trangchu/ticket/now']);
            }, 2000);
          } else {
            alert('Lỗi khi thanh toán: ' + response.message);
          }
        },
        error => {
          this.isLoading = false;
          alert('Lỗi kết nối: ' + error.message);
        }
      );
  }
  
  // Hiển thị thông báo thành công
  showSuccessNotification(): void {
    alert('Thanh toán thành công!');
  }
  
  // Xóa giỏ hàng và thông tin ghế đã chọn
  clearCartAndSeats(): void {
    this.cartItems = [];
    this.selectedSeats = [];
    localStorage.removeItem('selectedSeats');
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
