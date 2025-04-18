import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environment/environment';
import { finalize, catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { ServiceApiService } from '../../services/service-api.service';

// Định nghĩa kiểu cho environment
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

@Component({
  selector: 'app-bong-nuoc',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './bong-nuoc.component.html',
  styleUrl: './bong-nuoc.component.css'
})
export class BongNuocComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private serviceApi = inject(ServiceApiService); // Thêm service mới
  
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
  cartItems: (Service & { count?: number })[] = [];
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

  constructor() { }

  ngOnInit(): void {
    this.loadServiceTypes();
    this.loadCartFromLocalStorage();
    
    // Cập nhật thời gian hiện tại mỗi phút
    setInterval(() => {
      this.today = new Date();
    }, 60000);
  }

  ngOnDestroy(): void {
    // Cleanup code if needed
  }

  loadServiceTypes(): void {
    this.loading = true;
    this.isLoading = true;
    this.error = null;
    
    // Sử dụng URL API đúng theo yêu cầu
    this.http.get<ApiResponse<ServiceType[]>>(`${API_URL}/api/Service/GetServiceTypeList?currentPage=${this.currentPage}&recordPerPage=${this.recordsPerPage}`)
      .pipe(
        catchError(error => {
          console.error('Lỗi khi tải loại dịch vụ:', error);
          this.error = 'Không thể tải dữ liệu. Vui lòng thử lại sau.';
          
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
          this.serviceTypes = [];
          this.services = [];
          this.filteredServices = [];
        }
      });
  }

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

  getSelectedTypeName(): string {
    if (this.selectedType) {
      const type = this.serviceTypes.find(t => t.id === this.selectedType);
      return type ? type.name : '';
    }
    return '';
  }

  search(event: any): void {
    this.searchText = event.target.value;
    this.applyFilters();
  }

  addToCart(service: Service): void {
    // Tạo bản sao của dịch vụ để thêm vào giỏ hàng - không cần xử lý size
    const serviceToAdd = { 
      ...service,
      // Sử dụng giá gốc luôn
      price: service.price
    };
    
    this.cartItems.push(serviceToAdd);
    this.saveCartToLocalStorage();
    
    // Sử dụng toastr service - không hiển thị thông tin size
    this.toastr.success(`Đã thêm ${service.serviceName} vào giỏ hàng`, 'Thành công');
    
    console.log(`Đã thêm vào giỏ hàng: ${service.serviceName}`);
  }

  private loadCartFromLocalStorage(): void {
    const savedCart = localStorage.getItem('cartItems');
    if (savedCart) {
      try {
        this.cartItems = JSON.parse(savedCart);
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

  showCartModal(): void {
    this.isCartModalVisible = true;
  }

  hideCartModal(): void {
    this.isCartModalVisible = false;
  }

  // Cập nhật phương thức checkout
  checkout(): void {
    this.openPaymentModal();
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
              encodeURIComponent(`BankTransfer:${this.getTotalPrice()}:CINEMA_${this.orderId}`);
            
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
            
            // Hiển thị overlay in hóa đơn
            this.showPrintingOverlay = true;
            
            // Xóa giỏ hàng sau khi thanh toán thành công
            this.cartItems = [];
            this.saveCartToLocalStorage();
            
            this.toastr.success('Thanh toán thành công!', 'Hoàn tất');
            
            // Hiển thị hóa đơn
            this.showPrintReceipt(this.orderId, this.getTotalPrice(), this.formatPrice(this.getTotalPrice()));
          } else {
            this.toastr.error(response.message || 'Có lỗi xảy ra khi xác nhận thanh toán', 'Lỗi');
          }
        },
        error => {
          console.error('Lỗi khi xác nhận thanh toán:', error);
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
            body { font-family: Arial, sans-serif; }
            .receipt { padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .details { margin-bottom: 20px; }
            .table { width: 100%; border-collapse: collapse; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .total { text-align: right; margin-top: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>HÓA ĐƠN DỊCH VỤ</h1>
              <p>Mã đơn hàng: ${orderCode}</p>
              <p>Ngày: ${this.formatLocalDate(this.today)}</p>
            </div>
            <div class="details">
              <table class="table">
                <thead>
                  <tr>
                    <th>Dịch vụ</th>
                    <th>Số lượng</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.receiptItems.map(item => `
                    <tr>
                      <td>${item.serviceName}</td>
                      <td>${item.count || 1}</td>
                      <td>${this.formatPrice(item.price)}</td>
                      <td>${this.formatPrice((item.count || 1) * item.price)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="total">
              <p>Tổng cộng: ${formattedAmount}</p>
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
    // Đảm bảo sử dụng thời gian địa phương
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${hours}:${minutes} ${day}/${month}/${year}`;
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
    // Close payment modal
    this.closePaymentModal();
    
    if (paymentMethod) {
      this.selectedPaymentMethod = paymentMethod;
    }
    
    // Nếu là thanh toán tiền mặt (id = 1)
    if (this.selectedPaymentMethod && this.selectedPaymentMethod.id === 1) {
      // Show printing overlay và đặt trạng thái in
      this.showPrintingOverlay = true;
      this.isPrinting = true;
      
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

      // Lưu danh sách mặt hàng trong giỏ hàng để hiển thị sau khi thanh toán
      this.receiptItems = [...this.cartItems];
      this.receiptTotalAmount = this.getTotalPrice();

      // Gọi API thanh toán nhanh dịch vụ
      this.isLoading = true;
      // Thêm defaultCustomerEmail cho đơn hàng tại quầy
      const defaultCustomerEmail = "guest@cinema.com";
      this.serviceApi.quickServiceSale(serviceListJsonStr, this.currentUserId, defaultCustomerEmail)
        .pipe(
          finalize(() => {
            this.isLoading = false;
          }),
          catchError(error => {
            this.isPrinting = false; // Tắt trạng thái in nếu có lỗi
            this.showNotification('Lỗi khi xử lý thanh toán: ' + (error.error?.message || 'Không xác định'), 'error');
            return of({ responseCode: 400, message: error.message, data: null } as ApiResponse<any>);
          })
        )
        .subscribe(response => {
          if (response.responseCode === 200) {
            // Hiển thị hóa đơn để in
            this.showPrintReceipt(response.orderCode, response.totalAmount, this.formatPrice(response.totalAmount));
            
            // Xóa giỏ hàng
            this.cartItems = [];
            this.saveCartToLocalStorage();
            
            // Hiển thị thông báo thành công
            this.showNotification('Thanh toán thành công! Hóa đơn đã được in.', 'success');
          } else {
            this.isPrinting = false; // Tắt trạng thái in nếu có lỗi
            this.showNotification(response.message || 'Có lỗi xảy ra khi thanh toán', 'error');
          }
        });
    } else if (this.selectedPaymentMethod && this.selectedPaymentMethod.id === 2) {
      // Hiển thị thông báo chức năng đang phát triển
      this.showNotification('Chức năng thanh toán QR đang được phát triển. Vui lòng sử dụng phương thức thanh toán khác.', 'warning');
    }
  }

  // Mở modal chọn phương thức thanh toán
  openPaymentModal(): void {
    if (this.cartItems.length === 0) {
      this.showNotification('Giỏ hàng trống, hãy thêm dịch vụ!', 'warning');
      return;
    }
    this.showPaymentModal = true;
  }
  
  // Đóng modal chọn phương thức thanh toán
  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.selectedPaymentMethod = null;
  }
  
  // Tính tổng tiền của giỏ hàng
  calculateTotal(): number {
    return this.cartItems.reduce((total, item) => {
      return total + (item.price * (item.count || 1));
    }, 0);
  }

  /**
   * Payment methods management
   */
  loadPaymentMethods() {
    // Mock data for payment methods - already set in component properties
  }

  selectPaymentMethod(method: any): void {
    this.selectedPaymentMethod = method;
    
    // Nếu là thanh toán QR (chuyển khoản)
    if (method.id === 2) {
      this.closePaymentModal(); // Đóng modal thanh toán
      // Hiển thị thông báo cảnh báo cho người dùng
      this.showNotification('Chức năng thanh toán QR đang được phát triển. Vui lòng sử dụng phương thức thanh toán khác.', 'warning');
      return;
    } else {
      // Các phương thức khác, xử lý trực tiếp
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
}
