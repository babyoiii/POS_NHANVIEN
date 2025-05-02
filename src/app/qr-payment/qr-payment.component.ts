import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { catchError, switchMap } from 'rxjs/operators';
import { of, interval, Subscription, Observable } from 'rxjs';

interface PaymentTransaction {
  'Mã GD': number;
  'Mô tả': string;
  'Giá trị': number;
  'Ngày diễn ra': string;
  'Số tài khoản': string;
}

// Extend Window interface to include our custom function
declare global {
  interface Window {
    checkPaymentStatus: (apiUrl: string, paymentCode: string, amount: number) => Promise<{ found: boolean, transaction: PaymentTransaction | null }>;
  }
}

@Component({
  selector: 'app-qr-payment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-payment.component.html',
  styleUrl: './qr-payment.component.css'
})
export class QrPaymentComponent implements OnInit, OnDestroy {
  qrImageUrl: string = '';
  amount: number = 0;
  orderId: string = '';
  paymentCode: string = '';
  transactionId: string = '';
  isLoading: boolean = true; // Thêm biến isLoading để kiểm soát hiển thị

  // Timer properties
  timeLeft: number = 240; // 4 minutes in seconds
  timerInterval: any;
  timerExpired: boolean = false;

  // Payment status
  isConfirming: boolean = false;
  paymentConfirmed: boolean = false;
  paymentError: string = '';

  // Auto-check payment properties
  private paymentCheckSubscription: Subscription | null = null;
  private readonly PAYMENT_CHECK_INTERVAL = 10000; // 10 seconds
  private readonly PAYMENT_API_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhF4ow6KY0i5MMdKt9aEPxkXPke7lF9dr_IBt-7dlxaTCYK89CIM-lXf5qY7jrn9G6t229Iwkz3u_BMajDWbfBBeBeIZmAN0xGl9b03ZECcPu0-Tmwy_6LBun5b8kTDIKXJ7HOSqWlcYlW6OPhU1QRWf5SK9wedKyVnMLV5h4wuzbpcFUciOGMc6hnghsRQEytzcFo0lcP6DHNC6SRMZk-EMb6_MSUJihIxyVF7NapPN3cw1E4dNon8fiWxtcCyAhl3l3ZDIR9_A5jWewohvTKvV3T7Mt3y6zeOziM5&lib=MbobgF83VGNWrcCC3M4CGj24K8jOcnH58';
  isCheckingPayment: boolean = false;

  // Format for timer display
  get timerDisplay(): string {
    const minutes: number = Math.floor(this.timeLeft / 60);
    const seconds: number = this.timeLeft % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  // Progress percentage for timer bar
  get timerProgress(): number {
    return (this.timeLeft / 240) * 100;
  }

  // Flag to track if the script is loaded
  private scriptLoaded = false;

  constructor(
    private route: ActivatedRoute
  ) { }

  // Kiểm tra xem code đang chạy ở browser hay server
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  // Initialize the payment verification function directly in the component
  private initPaymentVerification(): void {
    if (this.scriptLoaded) {
      return;
    }

    // Define the checkPaymentStatus function directly
    window.checkPaymentStatus = (apiUrl: string, paymentCode: string, amount: number) => {
      return new Promise((resolve, reject) => {
        // Show in console what we're checking
        console.log('Đang kiểm tra thanh toán với mã:', paymentCode, 'và số tiền:', amount);

        // Fetch data from API
        fetch(apiUrl)
          .then(response => {
            if (!response.ok) {
              throw new Error('Không thể kết nối đến API. Mã lỗi: ' + response.status);
            }
            return response.json();
          })
          .then(result => {
            // Check if there's an error in the API response
            if (result.error) {
              throw new Error('API trả về lỗi: ' + result.error);
            }

            // Get transaction data
            const transactions = result.data;
            if (!transactions || transactions.length === 0) {
              console.log('Không có dữ liệu giao dịch');
              resolve({ found: false, transaction: null });
              return;
            }

            // Sort transactions by date (newest first)
            const sortedTransactions = [...transactions].sort((a, b) => {
              return new Date(b['Ngày diễn ra']).getTime() - new Date(a['Ngày diễn ra']).getTime();
            });

            // Find transaction with matching payment code
            const matchingTransaction = sortedTransactions.find(transaction => {
              const description = transaction['Mô tả'] || '';
              const transactionAmount = transaction['Giá trị'] || 0;

              // Check if description contains payment code
              const hasPaymentCode = description.toLowerCase().includes(paymentCode.toLowerCase());

              // Check if amount is sufficient (MUST be at least the required amount)
              const hasEnoughAmount = transactionAmount >= amount;

              console.log(`Kiểm tra giao dịch: ${transaction['Mã GD']}`);
              console.log(`- Mô tả: ${description}`);
              console.log(`- Số tiền: ${transactionAmount} (cần: ${amount})`);
              console.log(`- Có mã thanh toán: ${hasPaymentCode}`);
              console.log(`- Đủ số tiền: ${hasEnoughAmount}`);

              // MUST have both matching payment code AND sufficient amount
              return hasPaymentCode && hasEnoughAmount;
            });

            if (matchingTransaction) {
              console.log('Đã tìm thấy giao dịch phù hợp:', matchingTransaction['Mã GD']);
              resolve({ found: true, transaction: matchingTransaction });
            } else {
              console.log('Không tìm thấy giao dịch nào phù hợp');
              resolve({ found: false, transaction: null });
            }
          })
          .catch(error => {
            console.error('Lỗi khi kiểm tra thanh toán:', error);
            // In case of error, return a failure result
            reject(error);
          });
      });
    };

    this.scriptLoaded = true;
    console.log('Payment verification function initialized');
  }

  ngOnInit(): void {
    console.log('QR Payment Component - ngOnInit started');

    // Chỉ thực hiện các thao tác liên quan đến browser nếu đang ở môi trường browser
    if (!this.isBrowser()) {
      console.log('Đang chạy ở môi trường server, bỏ qua các thao tác browser');
      return;
    }

    // Initialize the payment verification function
    this.initPaymentVerification();

    // Bắt đầu đếm ngược ngay lập tức
    this.startTimer();

    // Lấy thông tin từ query params
    this.route.queryParams.subscribe({
      next: (params) => {
        console.log('Query params received:', params);

        if (params['amount']) {
          this.amount = +params['amount'];
          console.log('Đã lấy amount từ query params:', this.amount);
        }

        if (params['orderId']) {
          this.orderId = params['orderId'];
          console.log('Đã lấy orderId từ query params:', this.orderId);
        }

        if (params['paymentCode']) {
          this.paymentCode = params['paymentCode'];
          console.log('Đã lấy paymentCode từ query params:', this.paymentCode);
        }

        // Tạo URL QR nếu có amount và paymentCode
        if (this.amount > 0 && this.paymentCode) {
          this.qrImageUrl = `https://img.vietqr.io/image/970422-0334414209-compact2.png?amount=${this.amount}&addInfo=${this.paymentCode}&accountName=CineX`;
          console.log('Đã tạo qrImageUrl:', this.qrImageUrl);

          // Đánh dấu đã tải xong
          this.isLoading = false;

          // Bắt đầu kiểm tra thanh toán tự động nếu có đủ thông tin
          if (this.validateOrderId()) {
            console.log('Bắt đầu kiểm tra thanh toán tự động');
            // Trì hoãn việc kiểm tra thanh toán để tránh lỗi SSR
            setTimeout(() => {
              this.startAutoPaymentCheck();
            }, 1000);
          }
        } else {
          console.error('Không đủ thông tin để bắt đầu kiểm tra thanh toán tự động');
          this.paymentError = 'Không đủ thông tin thanh toán. Vui lòng thử lại.';
          this.isLoading = false; // Đánh dấu đã tải xong ngay cả khi có lỗi
        }
      },
      error: (err) => {
        console.error('Lỗi khi lấy query params:', err);
        this.paymentError = 'Có lỗi xảy ra khi tải thông tin thanh toán';
        this.isLoading = false; // Đánh dấu đã tải xong ngay cả khi có lỗi
      }
    });
  }

  ngOnDestroy(): void {
    // Clear the timer when component is destroyed
    this.clearTimer();

    // Clear payment check subscription
    this.stopAutoPaymentCheck();
  }

  // Bắt đầu kiểm tra thanh toán tự động
  startAutoPaymentCheck(): void {
    console.log('Bắt đầu kiểm tra thanh toán tự động');

    // Dừng kiểm tra cũ nếu có
    this.stopAutoPaymentCheck();

    // Kiểm tra ngay lập tức một lần
    this.isCheckingPayment = true;
    this.checkPaymentStatus().subscribe({
      next: (result: { found: boolean, transaction: PaymentTransaction | null }) => {
        this.isCheckingPayment = false;
        if (result && result.found && result.transaction) {
          this.autoConfirmPayment(result.transaction);
        } else {
          // Nếu không tìm thấy, bắt đầu kiểm tra định kỳ
          this.startPeriodicCheck();
        }
      },
      error: (error: any) => {
        console.error('Lỗi khi kiểm tra thanh toán lần đầu:', error);
        this.isCheckingPayment = false;
        // Vẫn bắt đầu kiểm tra định kỳ ngay cả khi có lỗi
        this.startPeriodicCheck();
      }
    });
  }

  // Bắt đầu kiểm tra định kỳ
  startPeriodicCheck(): void {
    console.log('Bắt đầu kiểm tra thanh toán định kỳ');

    this.paymentCheckSubscription = interval(this.PAYMENT_CHECK_INTERVAL)
      .pipe(
        switchMap(() => {
          // Chỉ kiểm tra khi timer chưa hết và chưa xác nhận thanh toán
          if (this.timerExpired || this.paymentConfirmed) {
            console.log('Bỏ qua kiểm tra thanh toán vì timer đã hết hoặc đã xác nhận thanh toán');
            return of(null);
          }

          this.isCheckingPayment = true;
          return this.checkPaymentStatus();
        }),
        catchError(error => {
          console.error('Lỗi khi kiểm tra thanh toán định kỳ:', error);
          this.isCheckingPayment = false;
          return of(null);
        })
      )
      .subscribe({
        next: (result: { found: boolean, transaction: PaymentTransaction | null } | null) => {
          this.isCheckingPayment = false;
          console.log('Kết quả kiểm tra thanh toán định kỳ:', result);

          // Nếu tìm thấy thanh toán hợp lệ, tự động xác nhận
          if (result && result.found && result.transaction) {
            this.autoConfirmPayment(result.transaction);
          }
        },
        error: (error: any) => {
          console.error('Lỗi trong quá trình xử lý kết quả kiểm tra thanh toán:', error);
          this.isCheckingPayment = false;
        }
      });
  }

  // Dừng kiểm tra thanh toán tự động
  stopAutoPaymentCheck(): void {
    if (this.paymentCheckSubscription) {
      this.paymentCheckSubscription.unsubscribe();
      this.paymentCheckSubscription = null;
    }
  }

  startTimer(): void {
    // Kiểm tra xem đang ở môi trường browser không
    if (!this.isBrowser()) {
      console.log('Không thể bắt đầu timer ở môi trường server');
      return;
    }

    this.timerInterval = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        this.timerExpired = true;
        this.clearTimer();
      }
    }, 1000);
  }

  clearTimer(): void {
    // Kiểm tra xem đang ở môi trường browser không
    if (!this.isBrowser()) {
      return;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  closeWindow(): void {
    if (this.isBrowser()) {
      window.close();
    }
  }

  // Restart the timer and reset expired state
  restartTimer(): void {
    this.clearTimer();
    this.timeLeft = 240;
    this.timerExpired = false;
    this.startTimer();
  }

  // Kiểm tra trạng thái thanh toán từ API sử dụng JavaScript
  checkPaymentStatus(): Observable<{ found: boolean, transaction: PaymentTransaction | null }> {
    // Kiểm tra xem đang ở môi trường browser không
    if (!this.isBrowser()) {
      console.log('Không thể kiểm tra thanh toán ở môi trường server');
      return of({ found: false, transaction: null });
    }

    console.log('Đang kiểm tra trạng thái thanh toán với mã:', this.paymentCode, 'và số tiền:', this.amount);

    // Sử dụng URL trực tiếp
    const directUrl = this.PAYMENT_API_URL;

    console.log('Gọi API trực tiếp:', directUrl);

    // Sử dụng JavaScript để kiểm tra thanh toán
    return new Observable<{ found: boolean, transaction: PaymentTransaction | null }>(observer => {
      // Kiểm tra xem function đã được khởi tạo chưa
      if (!this.scriptLoaded || typeof window.checkPaymentStatus !== 'function') {
        console.error('Function kiểm tra thanh toán chưa được khởi tạo');

        // Khởi tạo function
        this.initPaymentVerification();

        if (typeof window.checkPaymentStatus === 'function') {
          this.executePaymentCheck(directUrl, observer);
        } else {
          console.error('Không thể khởi tạo function kiểm tra thanh toán');
          observer.next({ found: false, transaction: null });
          observer.complete();
        }
      } else {
        this.executePaymentCheck(directUrl, observer);
      }
    });
  }

  // Thực hiện kiểm tra thanh toán bằng JavaScript
  private executePaymentCheck(apiUrl: string, observer: { next: (value: any) => void, complete: () => void, error: (err: any) => void }): void {
    try {
      // Gọi hàm JavaScript để kiểm tra thanh toán
      window.checkPaymentStatus(apiUrl, this.paymentCode, this.amount)
        .then((result: { found: boolean, transaction: PaymentTransaction | null }) => {
          observer.next(result);
          observer.complete();
        })
        .catch((error: Error) => {
          console.error('Lỗi khi kiểm tra thanh toán:', error);

          // Không sử dụng dữ liệu giả nữa, trả về không tìm thấy giao dịch
          console.log('Không thể kiểm tra thanh toán do lỗi API');

          observer.next({ found: false, transaction: null });
          observer.complete();
        });
    } catch (error) {
      console.error('Lỗi khi thực hiện kiểm tra thanh toán:', error);
      observer.next({ found: false, transaction: null });
      observer.complete();
    }
  }

  // Phương thức findMatchingTransaction đã được chuyển sang JavaScript

  // Tự động xác nhận thanh toán khi tìm thấy giao dịch phù hợp
  autoConfirmPayment(transaction: PaymentTransaction): void {
    console.log('Tìm thấy giao dịch phù hợp:', transaction);

    // Nếu đã xác nhận thanh toán rồi thì không làm gì
    if (this.paymentConfirmed || this.isConfirming) {
      return;
    }

    // Lưu mã giao dịch
    this.transactionId = transaction['Mã GD']?.toString() || '';

    // Gọi API xác nhận thanh toán
    this.confirmPayment();

    // Dừng timer và vô hiệu hóa nút xác nhận
    this.clearTimer();
    this.isConfirming = true;
  }

  // Kiểm tra thanh toán thủ công khi người dùng nhấn nút "Đã thanh toán"
  manualCheckPayment(): void {
    console.log('Kiểm tra thanh toán thủ công');

    if (this.isConfirming || this.isCheckingPayment) {
      console.log('Đang trong quá trình kiểm tra hoặc xác nhận, bỏ qua');
      return;
    }

    this.isCheckingPayment = true;
    this.paymentError = '';

    this.checkPaymentStatus().subscribe({
      next: (result: { found: boolean, transaction: PaymentTransaction | null }) => {
        this.isCheckingPayment = false;

        if (result && result.found && result.transaction) {
          console.log('Tìm thấy giao dịch phù hợp khi kiểm tra thủ công');
          this.autoConfirmPayment(result.transaction);
        } else {
          console.log('Không tìm thấy giao dịch phù hợp khi kiểm tra thủ công');
          this.paymentError = 'Không tìm thấy giao dịch thanh toán. Vui lòng kiểm tra lại sau khi đã thanh toán.';
        }
      },
      error: (error: any) => {
        console.error('Lỗi khi kiểm tra thanh toán thủ công:', error);
        this.isCheckingPayment = false;
        this.paymentError = 'Có lỗi xảy ra khi kiểm tra thanh toán. Vui lòng thử lại.';
      }
    });
  }

  // Xác nhận thanh toán thủ công - vẫn cần kiểm tra giao dịch
  confirmPaymentManually(): void {
    console.log('Xác nhận thanh toán thủ công - vẫn cần kiểm tra giao dịch');

    // Chuyển hướng sang phương thức kiểm tra thanh toán thủ công
    this.manualCheckPayment();
  }



  test(): void {

  }

  // Kiểm tra mã đơn hàng có hợp lệ không
  validateOrderId(): boolean {
    if (!this.orderId) {
      this.paymentError = 'Không tìm thấy mã đơn hàng';
      console.error('Không tìm thấy mã đơn hàng trong validateOrderId - orderId là undefined hoặc null');
      return false;
    }

    // Kiểm tra xem orderId có phải là chuỗi rỗng không
    if (this.orderId.trim() === '') {
      this.paymentError = 'Mã đơn hàng không hợp lệ';
      console.error('Mã đơn hàng là chuỗi rỗng trong validateOrderId');
      return false;
    }

    console.log('Mã đơn hàng hợp lệ:', this.orderId);
    return true;
  }

  // Confirm payment
  confirmPayment(): void {
    console.log('Bắt đầu xác nhận thanh toán với orderId:', this.orderId);

    // Không cần validate orderId vì chúng ta không gọi API confirmServicePayment nữa
    // Chỉ cần đánh dấu thanh toán thành công và lưu thông tin vào localStorage

    this.isConfirming = true;
    this.paymentError = '';

    // Lấy userId từ currentUser trong localStorage
    let userId = '0';
    try {
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser && currentUser.id) {
          userId = currentUser.id.toString();
          console.log('Đã lấy userId từ currentUser:', userId);
        } else {
          console.warn('currentUser không có id, sử dụng userId mặc định:', userId);
        }
      } else {
        console.warn('Không tìm thấy currentUser trong localStorage, sử dụng userId mặc định:', userId);
      }
    } catch (e) {
      console.error('Lỗi khi lấy userId từ localStorage:', e);
    }

    console.log('Xác nhận thanh toán thành công với:', {
      orderId: this.orderId,
      amount: this.amount,
      transactionId: this.transactionId
    });

    // Đánh dấu thanh toán thành công
    this.paymentConfirmed = true;
    this.clearTimer(); // Dừng timer khi thanh toán thành công
    this.stopAutoPaymentCheck(); // Dừng kiểm tra thanh toán tự động

    // Lưu thông tin thanh toán thành công vào localStorage để màn hình chính biết
    if (this.isBrowser()) {
      try {
        localStorage.setItem('payment_success', 'true');
        localStorage.setItem('payment_order_id', this.orderId);
        localStorage.setItem('payment_amount', this.amount.toString());
        localStorage.setItem('payment_transaction_id', this.transactionId);

        console.log('Đã lưu thông tin thanh toán thành công vào localStorage');
      } catch (e) {
        console.error('Lỗi khi lưu thông tin thanh toán vào localStorage:', e);
      }

      // Tự động đóng cửa sổ sau 3 giây để người dùng có thể thấy thông báo thành công
      setTimeout(() => {
        console.log('Đóng cửa sổ sau khi thanh toán thành công');
        window.close();
      }, 3000);
    }

    // Đánh dấu đã hoàn thành quá trình xác nhận
    this.isConfirming = false;
  }
}
