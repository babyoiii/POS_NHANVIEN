import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize, catchError } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';
import { ServiceApiService } from '../../services/service-api.service';
import { ConcessionSearchService } from '../../services/concession-search.service';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Định nghĩa kiểu dữ liệu
interface AppEnvironment {
  production: boolean;
  baseUrl: string;
  baseUrlLocation: string;
}

// Sử dụng URL API cố định
const API_URL = 'https://localhost:7263';

// Định nghĩa interface cho API response
interface ApiResponse<T> {
  responseCode: number;
  message: string;
  data: T;
  totalRecord?: number;
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
  count?: number;
  quantity?: number;
}

// Định nghĩa interface cho ServiceType (loại sản phẩm)
interface ServiceType {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  serviceList: Service[];
}

// Interface để TypeScript không báo lỗi
interface ToastService {
  success(message: string, title: string): void;
  error(message: string, title: string): void;
  info(message: string, title: string): void;
  warning(message: string, title: string): void;
}

// Tự tạo interface cho AuthService
interface User {
  userName: string;
  [key: string]: any;
}

// Tạm tạo service auth nếu chưa có
class AuthService {
  getCurrentUser(): User | null {
    return { userName: 'Nhân viên' };
  }
}

@Component({
  selector: 'app-bong-nuoc',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './bong-nuoc.component.html',
  styleUrl: './bong-nuoc.component.css'
})
export class BongNuocComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private serviceApi = inject(ServiceApiService);
  private searchService = inject(ConcessionSearchService);
  private router = inject(Router);
  private authService = new AuthService();
  
  private toastr: ToastService = {
    success: (message: string, title: string) => console.log(`SUCCESS: ${title} - ${message}`),
    error: (message: string, title: string) => console.log(`ERROR: ${title} - ${message}`),
    info: (message: string, title: string) => console.log(`INFO: ${title} - ${message}`),
    warning: (message: string, title: string) => console.log(`WARNING: ${title} - ${message}`)
  };
  
  // Thêm thuộc tính mới
  isPaymentModalVisible = false;
  serviceListJsonTemp = '';
  currentUserId = '3fa85f64-5717-4562-b3fc-2c963f66afa6'; // Giả sử ID nhân viên mặc định
  printingReceipt = false;
  
  services: Service[] = [];
  filteredServices: Service[] = [];
  serviceTypes: ServiceType[] = [];
  selectedType: string | null = null;
  searchText = '';
  loading: boolean = false;
  error: string | null = null;
  errorMessage: string | null = null; // Added for template compatibility
  selectedCategory: number = 0; // Added for template compatibility
  cartItems: (Service & { count?: number, quantity?: number })[] = [];
  isLoading = false;
  currentPage = 1;
  recordsPerPage = 20;
  totalRecords = 0;
  isCartModalVisible = false;
  
  // Thêm các thuộc tính mới cho thanh toán QR
  showQRCode = false;
  qrImageUrl = 'assets/Image/sample-qr.png'; // Replace with actual QR code
  orderId: string = '';
  paymentStatus = 'pending'; // 'pending', 'success', 'failed'
  today = new Date(); // Ngày hiện tại để hiển thị trên hóa đơn
  receiptItems: any[] = []; // Lưu danh sách mặt hàng cho hóa đơn
  receiptTotalAmount: number = 0; // Lưu tổng tiền cho hóa đơn

  // Payment Methods
  showPaymentOptions = false;
  isPrinting = false;
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

  showPaymentModal = false;
  showPrintingOverlay = false;
  selectedPaymentMethod: any = null;

  receiptContent: string = '';

  // Custom notification properties
  showCustomNotification = false;
  notificationType = '';
  notificationTitle = '';
  notificationMessage = '';
  notificationTimeout: any = null;

  // Search related
  private searchSubscription: Subscription | null = null;
  currentSearchTerm: string = '';

  // Thêm thuộc tính
  showCashPaymentModal = false;
  showReceiptModal = false;
  cashReceived = 0;
  changeAmount = 0;

  // Lưu các thuộc tính cần thiết cho component
  selectedSeats: any[] = []; // Danh sách ghế được chọn
  seatsTotalPrice: number = 0; // Tổng tiền ghế

  // Email khách hàng
  customerEmail: string = '';
  useDefaultEmail: boolean = true; // Mặc định dùng email guest
  defaultEmail: string = 'guest@cinema.com';
  isCheckingEmail: boolean = false;
  emailError: string = '';
  emailSuccess: string = '';
  customerInfo: any = null;

  constructor() { }

  ngOnInit(): void {
    this.loadServiceTypes();
    this.loadCartFromLocalStorage();
    
    // Subscribe to search query changes
    this.searchSubscription = this.searchService.searchQuery$.subscribe(query => {
      this.currentSearchTerm = query;
      this.applyFilters();
    });
    
    // Cập nhật thời gian hiện tại mỗi phút
    setInterval(() => {
      this.today = new Date();
    }, 60000);
  }

  ngOnDestroy(): void {
    // Clean up subscription
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  loadServiceTypes(): void {
    this.loading = true;
    this.isLoading = true;
    this.error = null;
    this.errorMessage = null; // Reset error message
    
    // Sử dụng URL API đúng theo yêu cầu
    this.http.get<ApiResponse<ServiceType[]>>(`${API_URL}/api/Service/GetServiceTypeList?currentPage=${this.currentPage}&recordPerPage=${this.recordsPerPage}`)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi tải loại dịch vụ:', error);
          this.error = 'Không thể tải dữ liệu. Vui lòng thử lại sau.';
          this.errorMessage = this.error;
          
          return of({
            responseCode: 400,
            message: 'Lỗi kết nối đến máy chủ',
            data: [] as ServiceType[],
            totalRecord: 0
          });
        }),
        finalize(() => {
          this.loading = false;
          this.isLoading = false;
        })
      )
      .subscribe(response => {
        if (response.responseCode === 200) {
          this.serviceTypes = response.data;
          this.totalRecords = response.totalRecord || 0;
          
          // Lấy tất cả dịch vụ từ tất cả danh mục
          this.services = [];
          response.data.forEach(type => {
            if (type.serviceList && type.serviceList.length > 0) {
              // Không cần thêm thông tin size nữa
              this.services = [...this.services, ...type.serviceList];
            }
          });
          
          this.applyFilters();
        } else {
          this.error = response.message || 'Đã xảy ra lỗi khi tải dữ liệu';
          this.errorMessage = this.error;
          this.serviceTypes = [];
          this.services = [];
          this.filteredServices = [];
        }
      });
  }

  applyFilters(): void {
    let result = [...this.services];

    // Apply category filter
    if (this.selectedType) {
      result = result.filter(service => service.serviceTypeID === this.selectedType);
    }

    // Filter by category if selected
    if (this.selectedCategory > 0) {
      const categoryMapping: { [key: number]: string } = {
        1: "bắp", // Popcorn
        2: "nước", // Drinks
        3: "combo" // Combo
      };
      
      if (categoryMapping[this.selectedCategory]) {
        const categoryTerm = categoryMapping[this.selectedCategory].toLowerCase();
        result = result.filter(service => 
          service.serviceName.toLowerCase().includes(categoryTerm) || 
          (service.description && service.description.toLowerCase().includes(categoryTerm))
        );
      }
    }

    // Apply search filter if there's text
    if (this.currentSearchTerm) {
      result = this.searchService.filterConcessions(result, this.currentSearchTerm);
    } else if (this.searchText) {
      // For backward compatibility with existing search
      const searchLower = this.searchText.toLowerCase();
      result = result.filter(
        service => 
          service.serviceName.toLowerCase().includes(searchLower) || 
          (service.description && service.description.toLowerCase().includes(searchLower))
      );
    }

    this.filteredServices = result;
    
    // Tự động đặt lại bộ lọc nếu không tìm thấy kết quả khi tìm kiếm
    if (this.filteredServices.length === 0 && this.searchText.trim() && this.services.length > 0) {
      console.log('Không tìm thấy kết quả cho từ khóa: ' + this.searchText);
      // Có thể thêm thông báo cho người dùng ở đây
    }
  }

  selectType(typeId: string | null): void {
    this.selectedType = typeId;
    this.applyFilters();
  }

  // Add method for template compatibility
  selectCategory(categoryId: number): void {
    this.selectedCategory = categoryId;
    this.applyFilters();
  }

  getSelectedTypeName(): string {
    if (this.selectedType) {
      const type = this.serviceTypes.find(t => t.id === this.selectedType);
      return type ? type.name : '';
    }
    return '';
  }

  // Add method for template compatibility
  getCategoryName(): string {
    if (this.selectedCategory === 0) {
      return 'Tất cả sản phẩm';
    } else if (this.selectedCategory === 1) {
      return 'Bắp';
    } else if (this.selectedCategory === 2) {
      return 'Nước';
    } else if (this.selectedCategory === 3) {
      return 'Combo';
    }
    return this.getSelectedTypeName() || 'Sản phẩm';
  }

  search(event?: any): void {
    if (event) {
      this.searchText = event.target.value;
    }
    this.searchService.updateSearchQuery(this.searchText);
  }

  // Add method for template compatibility
  clearSearch(): void {
    this.searchText = '';
    this.searchService.updateSearchQuery('');
    this.applyFilters();
  }

  addToCart(service: Service): void {
    // Kiểm tra sản phẩm đã tồn tại trong giỏ hàng chưa
    const existingItemIndex = this.cartItems.findIndex(item => item.id === service.id);
    
    if (existingItemIndex !== -1) {
      // Nếu sản phẩm đã tồn tại, tăng số lượng lên
      this.cartItems[existingItemIndex].quantity = (this.cartItems[existingItemIndex].quantity || 1) + 1;
      this.cartItems[existingItemIndex].count = (this.cartItems[existingItemIndex].count || 1) + 1;
      
      this.saveCartToLocalStorage();
      
      // Hiển thị thông báo
      this.toastr.success(`Đã thêm ${service.serviceName} vào giỏ hàng (SL: ${this.cartItems[existingItemIndex].quantity})`, 'Thành công');
      console.log(`Đã tăng số lượng sản phẩm trong giỏ hàng: ${service.serviceName} (SL: ${this.cartItems[existingItemIndex].quantity})`);
    } else {
      // Nếu sản phẩm chưa tồn tại, thêm mới vào giỏ hàng
      const serviceToAdd = { 
        ...service,
        price: service.price,
        quantity: 1,
        count: 1
      };
      
      this.cartItems.push(serviceToAdd);
      this.saveCartToLocalStorage();
      
      // Hiển thị thông báo
      this.toastr.success(`Đã thêm ${service.serviceName} vào giỏ hàng`, 'Thành công');
      console.log(`Đã thêm vào giỏ hàng: ${service.serviceName}`);
    }
  }

  private loadCartFromLocalStorage(): void {
    const savedCart = localStorage.getItem('cartItems');
    if (savedCart) {
      try {
        this.cartItems = JSON.parse(savedCart);
        // Ensure quantity is set for template compatibility
        this.cartItems.forEach(item => {
          if (!item.quantity && item.count) {
            item.quantity = item.count;
          } else if (!item.quantity) {
            item.quantity = 1;
          }
        });
      } catch (e) {
        console.error('Lỗi khi phân tích giỏ hàng từ localStorage:', e);
        this.cartItems = [];
      }
    }
  }

  private saveCartToLocalStorage(): void {
    localStorage.setItem('cartItems', JSON.stringify(this.cartItems));
  }

  retryLoading(): void {
    this.refreshAll();
  }

  // Add method for template compatibility
  getServices(): void {
    this.retryLoading();
  }

  get cartCount(): number {
    return this.cartItems.length;
  }

  viewCart(): void {
    if (this.cartItems.length === 0) {
      alert('Giỏ hàng của bạn đang trống');
      return;
    }
    
    let cartContent = 'Giỏ hàng của bạn:\n\n';
    let totalPrice = 0;
    
    this.cartItems.forEach((item, index) => {
      const price = item.price;
      totalPrice += price;
      cartContent += `${index + 1}. ${item.serviceName} - ${this.formatPrice(price)}\n`;
    });
    
    cartContent += `\nTổng cộng: ${this.formatPrice(totalPrice)}`;
    alert(cartContent);
  }

  removeFromCart(index: number): void {
    if (index >= 0 && index < this.cartItems.length) {
      this.cartItems.splice(index, 1);
      this.saveCartToLocalStorage();
    }
  }

  clearCart(): void {
    this.cartItems = [];
    this.saveCartToLocalStorage();
  }

  getTotalPrice(): number {
    return this.cartItems.reduce((total, item) => total + item.price, 0);
  }

  // Add method for template compatibility
  getTotalAmount(): number {
    return this.cartItems.reduce((total, item) => {
      return total + (item.price * (item.quantity || 1));
    }, 0);
  }

  showCartModal(): void {
    this.isCartModalVisible = true;
  }

  hideCartModal(): void {
    this.isCartModalVisible = false;
  }

  // Cập nhật phương thức checkout
  checkout(): void {
    // Kiểm tra email khách hàng nếu không sử dụng email mặc định
    if (!this.useDefaultEmail) {
      // Nếu không có email hoặc email trống
      if (!this.customerEmail || this.customerEmail.trim() === '') {
        alert('Vui lòng nhập email khách hàng!');
        return;
      }

      // Nếu có lỗi email
      if (this.emailError) {
        alert('Email không hợp lệ hoặc chưa được xác thực. Vui lòng kiểm tra lại email trước khi tiếp tục!');
        return;
      }
    }
    
    this.showPaymentModal = true;
  }

  // Thêm phương thức mới để đóng modal phương thức thanh toán
  closePaymentMethodModal(): void {
    this.isPaymentModalVisible = false;
  }

  // Thêm phương thức xử lý thanh toán tiền mặt
  processPaymentCash(): void {
    this.isLoading = true;
    this.isPaymentModalVisible = false;
    
    this.serviceApi.quickServiceSale(this.serviceListJsonTemp, this.currentUserId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe(
        response => {
          if (response.responseCode === 200) {
            this.toastr.success('Thanh toán thành công', 'Thành công');
            this.clearCart();
            // Hiển thị thông tin hóa đơn để in
            this.showPrintReceipt(response.orderCode, response.totalAmount, response.formattedTotalAmount);
          } else {
            this.toastr.error(response.message || 'Có lỗi xảy ra', 'Lỗi');
          }
        },
        error => {
          console.error('Lỗi khi thanh toán:', error);
          this.toastr.error('Không thể kết nối đến máy chủ', 'Lỗi');
        }
      );
  }

  // Thay thế phương thức generateQRCode để sử dụng API
  processPaymentQR(): void {
    this.isPaymentModalVisible = false;
    
    if (this.cartItems.length === 0) {
      this.toastr.warning('Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán', 'Giỏ hàng trống');
      return;
    }

    // Cập nhật thời gian hiện tại
    this.today = new Date();

    // Chuẩn bị dữ liệu đơn hàng
    const orderData = {
      services: this.cartItems.map(item => ({
        ServiceId: item.id,
        Quantity: item.count || 1
      }))
    };
    
    const serviceListJsonStr = JSON.stringify(orderData.services);

    // Gọi API tạo đơn hàng
    this.isLoading = true;
    this.serviceApi.createServiceOrder(serviceListJsonStr)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe(
        response => {
          if (response.responseCode === 200) {
            // Lưu mã đơn hàng để sau này xác nhận
            this.orderId = response.orderCode;
            
            // Tạo URL QR code sử dụng mã đơn và tổng tiền
            this.qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' +
              encodeURIComponent(`BankTransfer:${this.getTotalAmount()}:CINEMA_${this.orderId}`);
            
            this.showQRCode = true;
            this.isCartModalVisible = false;
            
            this.toastr.info('Vui lòng quét mã QR để hoàn tất thanh toán', 'Thanh toán');
          } else {
            this.toastr.error(response.message || 'Có lỗi xảy ra khi tạo đơn hàng', 'Lỗi');
          }
        },
        error => {
          console.error('Lỗi khi tạo đơn hàng:', error);
          this.toastr.error('Không thể kết nối đến máy chủ', 'Lỗi');
        }
      );
  }

  // Giữ lại phương thức generateQRCode cho nút thanh toán
  generateQRCode(): void {
    this.processPaymentQR();
  }

  // Close the QR code modal
  hideQRCode(): void {
    this.showQRCode = false;
  }

  // Cập nhật phương thức confirmPayment
  confirmPayment(): void {
    if (!this.orderId) {
      this.showNotification('Không tìm thấy mã đơn hàng', 'error');
      return;
    }
    
    // Cập nhật thời gian hiện tại
    this.today = new Date();
    
    this.isLoading = true;
    this.showPrintingOverlay = true; // Hiển thị overlay chờ xử lý
    this.isPrinting = true; // Đặt trạng thái đang xử lý
    
    this.serviceApi.confirmServicePayment(this.orderId, this.currentUserId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe(
        response => {
          if (response.responseCode === 200) {
            this.paymentStatus = 'success';
            this.showQRCode = false;
            
            // Xóa giỏ hàng sau khi thanh toán thành công
            this.cartItems = [];
            this.saveCartToLocalStorage();
            
            // Hiển thị hóa đơn
            this.showPrintReceipt(this.orderId, this.getTotalAmount(), this.formatPrice(this.getTotalAmount()));
            
            // Tắt overlay sau khi thanh toán thành công
            this.showPrintingOverlay = false;
            this.isPrinting = false;
            
            this.toastr.success('Thanh toán thành công!', 'Hoàn tất');
            
            // Thêm setTimeout đảm bảo overlay đã được đóng
            setTimeout(() => {
              if (this.showPrintingOverlay) {
                this.showPrintingOverlay = false;
                this.isPrinting = false;
              }
            }, 1000);
          } else {
            // Tắt overlay nếu có lỗi
            this.showPrintingOverlay = false;
            this.isPrinting = false;
            
            this.toastr.error(response.message || 'Có lỗi xảy ra khi xác nhận thanh toán', 'Lỗi');
          }
        },
        error => {
          console.error('Lỗi khi xác nhận thanh toán:', error);
          // Tắt overlay nếu có lỗi
          this.showPrintingOverlay = false;
          this.isPrinting = false;
          
          this.toastr.error('Không thể kết nối đến máy chủ', 'Lỗi');
        }
      );
  }

  closeAllModals(): void {
    this.isCartModalVisible = false;
    this.showQRCode = false;
    this.isPaymentModalVisible = false;
    this.showPaymentModal = false;
    this.showPrintingOverlay = false;
  }

  // Thêm phương thức mới để hiển thị và in hóa đơn
  showPrintReceipt(orderCode: string, amount: number, formattedAmount: string): void {
    // Bắt đầu in hóa đơn
    this.isPrinting = false; // Không còn đang in nữa
    this.orderId = orderCode; // Lưu mã đơn hàng để hiển thị
    
    // Tạo nội dung hóa đơn và lưu vào biến để sử dụng sau nếu người dùng chọn in
    this.receiptContent = `
      <html>
        <head>
          <title>Hóa đơn dịch vụ</title>
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
              <h1>HÓA ĐƠN DỊCH VỤ</h1>
              <p>Mã đơn hàng: ${orderCode}</p>
              <p>Ngày: ${this.formatLocalDate(this.today)}</p>
              <p>Nhân viên: ${this.getStaffName()}</p>
            </div>
            
            <div class="section-title">THÔNG TIN VÉ</div>
            <div class="seats-section">
              ${this.selectedSeats && this.selectedSeats.length > 0 ? 
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
                <span>${this.formatPrice(this.seatsTotalPrice || 0)}</span>
              </div>
            </div>
            
            <div class="section-title">THÔNG TIN DỊCH VỤ</div>
            <div class="details">
              <table class="table">
                <thead>
                  <tr>
                    <th>Dịch vụ</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th class="amount">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.receiptItems.map(item => `
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
              <p>Tổng cộng: ${formattedAmount}</p>
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

  // Thêm phương thức định dạng thời gian địa phương
  formatLocalDate(date: Date): string {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Phương thức mới để in hóa đơn khi người dùng chọn in
  printReceipt(): void {
    if (!this.receiptContent) {
      this.showNotification('Không có nội dung hóa đơn để in', 'error');
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
      this.showNotification('Trình duyệt đã chặn cửa sổ popup. Vui lòng cho phép popup để in hóa đơn.', 'warning');
    }
  }

  // Thêm phương thức mới để tải lại tất cả dữ liệu
  refreshAll(): void {
    this.services = [];
    this.filteredServices = [];
    this.serviceTypes = [];
    this.error = null;
    this.errorMessage = null;
    this.currentPage = 1;
    
    this.loadServiceTypes();
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  // Process payment based on selected method
  processPayment(paymentMethod?: any): void {
    if (!paymentMethod) {
      if (!this.selectedPaymentMethod) {
        this.showNotification('Vui lòng chọn phương thức thanh toán', 'error');
        return;
      }
      paymentMethod = this.selectedPaymentMethod;
    }

    // Lưu thông tin email được sử dụng 
    const userEmail = this.useDefaultEmail ? this.defaultEmail : this.customerEmail;
    localStorage.setItem('lastOrderEmail', userEmail);
    console.log('Email khách hàng:', userEmail);

    // Close the payment modal
    this.closePaymentModal();

    if (paymentMethod.id === 1) { // Tiền mặt
      this.openCashPaymentModal();
    } else if (paymentMethod.id === 2) { // QR Code
      // Hiển thị QR code
      console.log('Hiển thị QR code');
    }
  }

  // Kiểm tra email khách hàng
  checkCustomerEmail(email: string): void {
    if (!email || email.trim() === '') {
      this.emailError = 'Vui lòng nhập email';
      return;
    }
    
    // Validate email format using regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      this.emailError = 'Email không đúng định dạng';
      return;
    }
    
    this.isCheckingEmail = true;
    this.emailError = '';
    this.emailSuccess = '';
    
    // Giả lập API call và kết quả trả về - trong môi trường thực tế sẽ gọi API thực
    setTimeout(() => {
      if (email.includes('@gmail.com') || email.includes('@yahoo.com') || email.includes('@hotmail.com')) {
        this.customerInfo = {
          email: email,
          name: 'Khách hàng',
          points: 100
        };
        this.emailSuccess = 'Đã tìm thấy thông tin khách hàng';
      } else {
        this.customerInfo = null;
        this.emailError = 'Email không đúng hoặc chưa được tạo tài khoản. Vui lòng nhập email đúng hoặc tạo tài khoản trước';
      }
      this.isCheckingEmail = false;
    }, 1000);
  }

  // Xử lý khi nhập email
  handleEmailInput(email: string): void {
    this.customerEmail = email;
    this.checkCustomerEmail(email);
  }

  // Mở modal chọn phương thức thanh toán
  openPaymentModal(): void {
    this.showPaymentModal = true;
    this.selectedPaymentMethod = null;
  }

  // Đóng modal chọn phương thức thanh toán
  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.selectedPaymentMethod = null;
  }

  // Tính tổng tiền của giỏ hàng
  calculateTotalPrice(): number {
    let total = 0;
    this.cartItems.forEach(item => {
      total += item.price * (item.count || 1);
    });
    return total;
  }

  /**
   * Payment methods management
   */
  loadPaymentMethods() {
    // Mock data for payment methods - already set in component properties
  }

  selectPaymentMethod(method: any): void {
    this.selectedPaymentMethod = method;
    
    // Đóng modal phương thức thanh toán
    this.closePaymentModal();
    
    // Nếu là thanh toán tiền mặt, mở modal nhập tiền
    if (method === 'cash' || (method?.id === 1)) {
      setTimeout(() => {
        this.openCashPaymentModal();
      }, 300);
    } else if (method === 'qr' || (method?.id === 2)) {
      // Hiển thị thông báo chức năng đang phát triển
      this.showNotification('Chức năng thanh toán QR đang được phát triển. Vui lòng sử dụng phương thức thanh toán khác.', 'warning');
    } else {
      // Xử lý các phương thức khác
      this.processPayment(method);
    }
  }

  // Modify checkOut() to open payment modal instead
  checkOut(): void {
    if (this.cartItems.length === 0) {
      this.showNotification('Giỏ hàng trống, hãy thêm dịch vụ!', 'error');
      return;
    }
    
    this.openPaymentModal();
  }

  // Add after confirmQrPayment
  closePrintingOverlay(): void {
    // Nếu đang in, đặt câu hỏi xác nhận
    if (this.isPrinting) {
      if (confirm('Bạn có chắc muốn hủy quá trình thanh toán?')) {
        this.showPrintingOverlay = false;
        this.isPrinting = false;
      }
    } else {
      // Nếu đã in xong, đơn giản là đóng overlay
      this.showPrintingOverlay = false;
    }
  }

  // Hiển thị thông báo
  showNotification(message: string, type: string): void {
    // Đặt tiêu đề thông báo dựa trên loại
    switch (type) {
      case 'success':
        this.notificationTitle = 'Thành công';
        break;
      case 'error':
        this.notificationTitle = 'Lỗi';
        break;
      case 'warning':
        this.notificationTitle = 'Cảnh báo';
        break;
      default:
        this.notificationTitle = 'Thông tin';
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

  // For API integration
  getOrderStatus(orderId: string): Observable<any> {
    return this.serviceApi.getOrderStatus(orderId);
  }

  // Tăng số lượng sản phẩm trong giỏ hàng
  increaseQuantity(index: number): void {
    if (index >= 0 && index < this.cartItems.length) {
      this.cartItems[index].quantity = (this.cartItems[index].quantity || 1) + 1;
      this.cartItems[index].count = (this.cartItems[index].count || 1) + 1;
      this.saveCartToLocalStorage();
    }
  }

  // Giảm số lượng sản phẩm trong giỏ hàng
  decreaseQuantity(index: number): void {
    if (index >= 0 && index < this.cartItems.length) {
      if (this.cartItems[index].quantity && this.cartItems[index].quantity > 1) {
        this.cartItems[index].quantity -= 1;
        this.cartItems[index].count = this.cartItems[index].quantity;
        this.saveCartToLocalStorage();
      } else {
        // Nếu số lượng là 1, hỏi người dùng có muốn xóa không
        if (confirm('Bạn có muốn xóa sản phẩm này khỏi giỏ hàng?')) {
          this.removeFromCart(index);
        }
      }
    }
  }

  // Cập nhật số lượng sản phẩm trực tiếp
  updateQuantity(index: number, newQuantity: number): void {
    if (index >= 0 && index < this.cartItems.length) {
      if (newQuantity > 0) {
        this.cartItems[index].quantity = newQuantity;
        this.cartItems[index].count = newQuantity;
        this.saveCartToLocalStorage();
      } else {
        // Nếu số lượng <= 0, hỏi người dùng có muốn xóa không
        if (confirm('Bạn có muốn xóa sản phẩm này khỏi giỏ hàng?')) {
          this.removeFromCart(index);
        } else {
          // Nếu không xóa, đặt lại số lượng là 1
          this.cartItems[index].quantity = 1;
          this.cartItems[index].count = 1;
          this.saveCartToLocalStorage();
        }
      }
    }
  }

  // Đóng mở modal thanh toán tiền mặt
  openCashPaymentModal(): void {
    this.showCashPaymentModal = true;
    this.cashReceived = 0;
    this.calculateChange();
  }

  closeCashPaymentModal(): void {
    this.showCashPaymentModal = false;
  }

  // Tính tiền thừa
  calculateChange(): void {
    this.changeAmount = this.cashReceived - this.getTotalAmount();
  }

  // Đặt số tiền nhanh
  setQuickAmount(amount: number): void {
    this.cashReceived = amount;
    this.calculateChange();
  }

  // Xử lý thanh toán tiền mặt
  processCashPayment(): void {
    if (this.cashReceived < this.getTotalAmount()) {
      this.showNotification('Tiền khách đưa không đủ', 'error');
      return;
    }

    // Đóng modal thanh toán
    this.closeCashPaymentModal();
    
    // Hiển thị overlay chờ xử lý
    this.showPrintingOverlay = true;
    this.isPrinting = true;
    
    // Cập nhật thời gian hiện tại
    this.today = new Date();
    
    // Chuẩn bị dữ liệu đơn hàng
    const orderData = {
      services: this.cartItems.map(item => ({
        ServiceId: item.id,
        Quantity: item.quantity || item.count || 1
      }))
    };

    const serviceListJsonStr = JSON.stringify(orderData.services);

    // Lưu danh sách mặt hàng cho hóa đơn
    this.receiptItems = [...this.cartItems];
    this.receiptTotalAmount = this.getTotalAmount();

    // Gọi API tạo đơn hàng
    this.isLoading = true;
    // Sử dụng email đã chọn (tự nhập hoặc mặc định)
    const customerEmail = this.useDefaultEmail ? this.defaultEmail : this.customerEmail;
    
    // Lưu email đã sử dụng vào localStorage
    localStorage.setItem('lastOrderEmail', customerEmail);
    
    this.serviceApi.quickServiceSale(serviceListJsonStr, this.currentUserId, customerEmail)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
        catchError(error => {
          this.isPrinting = false;
          this.showPrintingOverlay = false;
          this.showNotification('Lỗi khi xử lý thanh toán: ' + (error.error?.message || 'Không xác định'), 'error');
          return of({ responseCode: 400, message: error.message, data: null } as ApiResponse<any>);
        })
      )
      .subscribe(response => {
        if (response.responseCode === 200) {
          // Tắt overlay xử lý
          this.showPrintingOverlay = false;
          this.isPrinting = false;
          
          // Lưu mã đơn hàng
          this.orderId = response.orderCode || '';
          
          // Xóa giỏ hàng
          this.cartItems = [];
          this.saveCartToLocalStorage();
          
          // Mở modal in hóa đơn
          this.openReceiptModal();
          
          // Hiển thị thông báo thành công
          this.showNotification('Thanh toán thành công!', 'success');
        } else {
          this.isPrinting = false;
          this.showPrintingOverlay = false;
          this.showNotification(response.message || 'Có lỗi xảy ra khi thanh toán', 'error');
        }
      });
  }

  // Đóng mở modal hóa đơn
  openReceiptModal(): void {
    this.showReceiptModal = true;
  }

  closeReceiptModal(): void {
    this.showReceiptModal = false;
  }

  // Xuất file PDF
  exportToPdf(): void {
    const element = document.getElementById('receipt-content');
    if (!element) {
      this.showNotification('Không thể tạo PDF', 'error');
      return;
    }

    this.showNotification('Đang xuất file PDF...', 'info');
    
    // Clone the element to work with a copy without affecting the display
    const clonedElement = element.cloneNode(true) as HTMLElement;
    
    // Create a temporary container to hold our clone with proper styling
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = element.offsetWidth + 'px';
    
    // Apply specific styles to ensure it renders completely
    clonedElement.style.overflow = 'visible';
    clonedElement.style.maxHeight = 'none';
    clonedElement.style.height = 'auto';
    clonedElement.style.position = 'relative';
    
    // Append to temporary container and add to document
    tempContainer.appendChild(clonedElement);
    document.body.appendChild(tempContainer);
    
    // Ensure all images in the cloned element are loaded
    const images = Array.from(clonedElement.getElementsByTagName('img'));
    const imagePromises = images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    
    // Continue after all images are loaded
    Promise.all(imagePromises).then(() => {
      // Fix the logo size and position in the cloned element
      const logoImg = clonedElement.querySelector('.cinema-logo img') as HTMLImageElement;
      if (logoImg) {
        logoImg.style.maxWidth = '150px';
        logoImg.style.display = 'block';
        logoImg.style.margin = '0 auto';
      }
      
      // Use html2canvas to capture the entire cloned element
      html2canvas(clonedElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
        imageTimeout: 2000,
        height: clonedElement.offsetHeight, // Use the full height
        windowHeight: clonedElement.offsetHeight // Ensure the entire element is captured
      }).then(canvas => {
        // Clean up - remove the temporary container
        document.body.removeChild(tempContainer);
        
        // Create PDF
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        // Convert to image and add to PDF
        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png');
        
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        
        // Add multiple pages if needed
        if (imgHeight > 297) { // 297mm is A4 height
          let heightLeft = imgHeight - 297;
          let position = -297;
          
          while (heightLeft > 0) {
            position = position - Math.min(297, heightLeft);
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= 297;
          }
        }
        
        // Save the PDF
        const fileName = `Hoa-Don-${this.orderId || new Date().getTime()}.pdf`;
        pdf.save(fileName);
        
        this.showNotification(`Đã xuất file PDF thành công: ${fileName}`, 'success');
      }).catch(error => {
        console.error('Lỗi khi tạo PDF:', error);
        // Clean up in case of error
        if (document.body.contains(tempContainer)) {
          document.body.removeChild(tempContainer);
        }
        this.showNotification('Có lỗi xảy ra khi tạo PDF: ' + error.message, 'error');
      });
    });
  }

  // Phương thức lấy tên nhân viên (có thể thêm logic lấy tên thực tế sau)
  getStaffName(): string {
    return 'Nhân viên bán hàng';
  }

  // Chuẩn bị nội dung hóa đơn
  prepareReceiptContent(): void {
    // Lấy thông tin người dùng hiện tại
    const currentUser = this.authService.getCurrentUser();
    const staffName = currentUser ? currentUser.userName : 'Nhân viên';
    
    // Tạo mã đơn hàng
    const orderCode = `ORD-${new Date().getTime()}`;
    
    // Tính tổng tiền
    const totalAmount = this.calculateTotalPrice() + this.seatsTotalPrice;
    
    // Tạo nội dung cho phần ghế
    let seatsSection = '';
    if (this.selectedSeats && this.selectedSeats.length > 0) {
      seatsSection = `
        <div class="details">
          <h3 style="font-size: 14px; margin: 10px 0;">THÔNG TIN VÉ</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Ghế</th>
                <th class="amount">Giá vé</th>
              </tr>
            </thead>
            <tbody>
              ${this.selectedSeats.map(seat => `
                <tr>
                  <td>${seat.seatName || seat.name}</td>
                  <td class="amount">${this.formatPrice(seat.price)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      seatsSection = '';
    }
    
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
              background: #fff;
              padding: 15px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .logo {
              text-align: center;
              margin-bottom: 20px;
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
        <body onload="window.print(); setTimeout(function() { window.close(); }, 500);">
          <div class="receipt">
            <div class="logo">
              <img src="assets/Image/cinexLogo.png" alt="Cinema Logo">
            </div>
            <div class="header">
              <h1>HÓA ĐƠN THANH TOÁN</h1>
              <p>Mã đơn hàng: ${orderCode}</p>
              <p>Ngày: ${this.formatLocalDate(new Date())}</p>
              <p>Nhân viên: ${staffName}</p>
            </div>
            
            ${seatsSection}
            
            ${this.cartItems.length > 0 ? `
            <div class="details">
              <h3 style="font-size: 14px; margin: 10px 0;">BẮP NƯỚC & THỨC ĂN</h3>
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
            ` : ''}
            
            <div class="total">
              <p>Tổng cộng: ${this.formatPrice(totalAmount)}</p>
            </div>
            
            <div class="barcode">
              * ${orderCode} *
            </div>
            
            <div class="footer">
              <p>Cảm ơn quý khách đã sử dụng dịch vụ!</p>
              <p>Quý khách vui lòng giữ hóa đơn để đối chiếu khi cần thiết</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // Chuyển hướng đến trang thanh toán
  goToPayment(): void {
    this.router.navigate(['/payment']);
  }

  // Quay lại trang trước đó và reset ghế đã chọn
  goBack(): void {
    // Reset trạng thái ghế đã chọn
    this.selectedSeats = [];
    this.seatsTotalPrice = 0;
    
    // Lưu trạng thái mới vào localStorage
    localStorage.removeItem('selectedSeats');
    
    // Thông báo thành công
    this.showNotification('Đã hủy chọn ghế', 'success');
    
    // Quay lại trang chủ
    this.router.navigate(['/trang-chu']);
  }
}
