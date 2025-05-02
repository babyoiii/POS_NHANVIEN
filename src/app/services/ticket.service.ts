import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { WebsocketService, SeatStatus, SeatStatusUpdateRequest } from './websocket.service';
import { SeatInfo } from '../models/SeatModel';

// Interface cho kiểm tra user theo email
interface UserResponse {
  responseCode: number;
  message: string;
  user?: any;
}

// Định nghĩa interfaces cho responses
interface ApiResponse {
  responseCode: number;
  message: string;
  orderCode?: string; // Explicit optional property
}

// Interface cho thông tin vé đáp ứng cấu trúc từ API
interface TicketInfo {
  ticketCode: string;
  seatStatusByShowTimeId?: string; // API có thể dùng lower camelCase
  SeatStatusByShowTimeId?: string; // Hoặc PascalCase
  showTimeId?: string; // Có thể showTimeId
  ShowTimeId?: string; // Hoặc ShowTimeId
  seatName: string;
  status: number;
}

interface OrderInfoResponse {
  responseCode: number;
  message: string;
  orderInfo: {
    orderId: string;
    orderCode: string;
    status: number;
  };
  tickets: TicketInfo[];
  services: any[];
  userId?: string;
}

// Interface cho kết quả hoàn vé
interface RefundResponse {
  responseCode: number;
  message: string;
  refundDetails?: {
    email: string;
    refundAmount: number;
    orderCode: string;
    showTimeId: string;
    seatStatusByShowTimeIds: string[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private apiUrl = 'https://localhost:7263';
  private wsConnectionMap = new Map<string, boolean>(); // Lưu trạng thái kết nối WebSocket theo showtimeId

  constructor(
    private http: HttpClient,
    private websocketService: WebsocketService
  ) { }

  // API tạo đơn hàng vé và dịch vụ
  createTicketAndServiceOrder(data: any): Observable<ApiResponse> {
    // Log dữ liệu gửi đi để debug
    console.log('Creating order with data:', JSON.stringify(data, null, 2));
    
    // Sử dụng URL endpoint dựa trên API đã test thành công
    return this.http.post<ApiResponse>(`${this.apiUrl}/api/Counter/Booking/TicketAndService`, data)
      .pipe(catchError(error => {
        console.error('Error creating order:', error);
        console.error('Request data was:', data);
        return throwError(() => error);
      }));
  }

  // API thanh toán đơn hàng vé và dịch vụ
  confirmTicketAndServicePayment(orderCode: string, userId: string): Observable<ApiResponse> {
    console.log(`Confirming payment for order: ${orderCode}, userId: ${userId}`);
    
    return this.http.post<ApiResponse>(`${this.apiUrl}/api/Counter/Booking/Payment`, {
      orderCode,
      userId
    }).pipe(
      tap((response: ApiResponse) => {
        console.log(`Payment API response:`, response);
        if (response.responseCode === 200) {
          console.log(`Payment successful, getting order info to update seats`);
          // Sau khi thanh toán thành công, lấy thông tin đơn hàng để cập nhật ghế
          this.getOrderInfo(orderCode).subscribe(
            (orderInfo: OrderInfoResponse) => {
              console.log(`Retrieved order info for payment update:`, orderInfo);
              this.updateSeatStatusAfterPayment(orderInfo);
            },
            (error) => {
              console.error(`Failed to get order info after payment:`, error);
            }
          );
        } else {
          console.error(`Payment API returned error code: ${response.responseCode}`);
        }
      }),
      catchError(error => {
        console.error('Error confirming payment:', error);
        return throwError(() => error);
      })
    );
  }

  // API lấy thông tin đơn hàng
  getOrderInfo(orderCode: string): Observable<OrderInfoResponse> {
    console.log(`Getting order info for order: ${orderCode}`);
    
    return this.http.get<OrderInfoResponse>(`${this.apiUrl}/api/Counter/Booking/GetOrderInfo/${orderCode}`)
      .pipe(
        tap(response => console.log(`Order info response:`, response)),
        catchError(error => {
          console.error('Error getting order info:', error);
          return throwError(() => error);
        })
      );
  }

  // API hủy đơn hàng
  cancelOrder(orderCode: string, userId: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/api/Counter/Booking/CancelOrder`, {
      orderCode,
      userId
    }).pipe(catchError(error => {
      console.error('Error canceling order:', error);
      return throwError(() => error);
    }));
  }
  
  // Cập nhật trạng thái ghế sau khi thanh toán thành công
  private updateSeatStatusAfterPayment(orderInfo: OrderInfoResponse): void {
    try {
      // Kiểm tra chặt chẽ để đảm bảo đơn hàng đã được tạo thành công
      if (orderInfo.responseCode === 200 && 
          orderInfo.tickets && 
          orderInfo.tickets.length > 0 && 
          orderInfo.orderInfo && 
          orderInfo.orderInfo.orderId) {
        
        console.log('Order created successfully, updating seat status via WebSocket');
        const seatUpdates: SeatStatusUpdateRequest[] = [];
        
        // Lấy showTimeId từ localStorage, đảm bảo không bị mất thông tin
        const showTimeId = localStorage.getItem('currentShowTimeId');
        
        // Đảm bảo có showTimeId trước khi tiếp tục
        if (showTimeId) {
          console.log(`Using showTimeId: ${showTimeId} for seat status update`);
          
          // Đảm bảo có kết nối WebSocket trước khi cập nhật trạng thái ghế
          this.ensureWebSocketConnection(showTimeId, orderInfo.userId || 'counter-user')
            .subscribe(connected => {
              if (connected) {
                // Mỗi vé có một ghế tương ứng
                orderInfo.tickets.forEach((ticket: TicketInfo) => {
                  // Tìm ID của SeatByShowTime từ dữ liệu vé, xử lý cả hai trường hợp
                  let seatStatusId = ticket.seatStatusByShowTimeId || ticket.SeatStatusByShowTimeId;
                  
                  if (seatStatusId) {
                    console.log(`Updating seat status for ${seatStatusId} to BOOKED (5)`);
                    seatUpdates.push({
                      SeatId: seatStatusId,
                      Status: SeatStatus.BOOKED // 5 - Đã thanh toán
                    });
                  }
                });
                
                // Nếu có ghế cần cập nhật, gửi yêu cầu qua WebSocket
                if (seatUpdates.length > 0) {
                  console.log(`Sending WebSocket payment update for ${seatUpdates.length} seats`);
                  
                  // 1. Gửi thông báo Payment để cập nhật trạng thái ghế
                  this.websocketService.payment(seatUpdates);
                  
                  // 2. Yêu cầu cập nhật danh sách ghế mới nhất sau khi thanh toán
                  setTimeout(() => {
                    console.log('Requesting updated seat list after payment');
                    this.websocketService.getList();
                    
                    // 3. Đảm bảo xóa dữ liệu ghế đã chọn trong localStorage
                    console.log('Clearing selected seats data');
                    localStorage.removeItem('selectedSeats');
                    // Không xóa currentShowTimeId để tránh lỗi khi quay lại trang showtime
                    // localStorage.removeItem('currentShowTimeId'); 
                  }, 800); // Tăng delay để đảm bảo server xử lý xong Payment trước
                }
              }
            });
        } else {
          console.error('No showTimeId found in localStorage');
        }
      } else {
        console.error('Order not created or invalid order info, Payment action not sent');
        if (orderInfo.responseCode !== 200) {
          console.error(`Order response code: ${orderInfo.responseCode}`);
        }
        if (!orderInfo.tickets || orderInfo.tickets.length === 0) {
          console.error('No tickets found in order info');
        }
      }
    } catch (error) {
      console.error('Error updating seat status:', error);
    }
  }
  
  // Đảm bảo rằng WebSocket đã được kết nối trước khi thực hiện thao tác
  private ensureWebSocketConnection(showtimeId: string, userId: string): Observable<boolean> {
    const connectionKey = `${showtimeId}-${userId}`;
    
    // Đảm bảo showtimeId và userId đã được chuyển sang chữ hoa để khớp với format
    const showtimeIdUpper = showtimeId.toUpperCase();
    const userIdUpper = userId.toUpperCase();
    
    console.log(`Ensuring WebSocket connection with roomId=${showtimeIdUpper}, userId=${userIdUpper}`);
    
    if (this.wsConnectionMap.get(connectionKey)) {
      console.log('Using existing WebSocket connection');
      return of(true); // Đã kết nối
    }
    
    try {
      // Thiết lập kết nối WebSocket mới
      console.log('Creating new WebSocket connection');
      this.websocketService.connect(showtimeIdUpper, userIdUpper);
      this.wsConnectionMap.set(connectionKey, true);
      return of(true);
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      return of(false);
    }
  }

  // Lấy websocketService để sử dụng trong component
  getWebsocketService() {
    return this.websocketService;
  }

  /**
   * Hoàn vé dựa trên mã đơn hàng
   * @param orderCode Mã đơn hàng cần hoàn
   * @returns Observable<RefundResponse> Thông tin kết quả hoàn vé
   */
  refundOrder(orderCode: string): Observable<RefundResponse> {
    const url = `${this.apiUrl}/api/Counter/RefundOrder/${orderCode}`;
    
    console.log(`Đang gọi API hoàn vé cho đơn hàng: ${orderCode}`);
    
    return this.http.post<RefundResponse>(url, {}).pipe(
      tap(response => {
        console.log('Kết quả hoàn vé:', response);
        
        // Nếu hoàn vé thành công và có thông tin về ghế, cập nhật trạng thái ghế thông qua WebSocket
        if (response.responseCode === 200 && response.refundDetails && response.refundDetails.seatStatusByShowTimeIds && response.refundDetails.seatStatusByShowTimeIds.length > 0) {
          const showTimeId = response.refundDetails.showTimeId;
          const userId = 'counter-user'; // Hoặc lấy userId từ auth service nếu có
          
          // Đảm bảo có kết nối WebSocket trước khi cập nhật trạng thái ghế
          this.ensureWebSocketConnection(showTimeId, userId).subscribe(connected => {
            if (connected && response.refundDetails) {
              // Cập nhật trạng thái ghế về trống (0) thông qua WebSocket
              const seatUpdates: SeatStatusUpdateRequest[] = response.refundDetails.seatStatusByShowTimeIds.map(seatId => ({
                SeatId: seatId,
                Status: SeatStatus.AVAILABLE
              }));
              
              console.log(`Cập nhật ${seatUpdates.length} ghế về trạng thái AVAILABLE (0) sau khi hoàn vé`);
              this.websocketService.updateStatus(seatUpdates);
            }
          });
        }
      }),
      catchError(error => {
        console.error('Lỗi khi thực hiện hoàn vé:', error);
        return throwError(() => new Error('Không thể hoàn vé. Vui lòng thử lại sau.'));
      })
    );
  }

  /**
   * Kiểm tra thông tin người dùng dựa trên email
   * @param email Email cần kiểm tra
   * @returns Observable<UserResponse> Thông tin người dùng nếu có
   */
  getUserByEmail(email: string): Observable<UserResponse> {
    const url = `${this.apiUrl}/api/Counter/GetUserByEmail?email=${encodeURIComponent(email)}`;
    
    console.log(`Đang kiểm tra thông tin người dùng với email: ${email}`);
    
    return this.http.get<UserResponse>(url).pipe(
      tap(response => {
        console.log('Kết quả kiểm tra email:', response);
      }),
      catchError(error => {
        console.error('Lỗi khi kiểm tra email:', error);
        return throwError(() => new Error('Không thể kiểm tra thông tin email. Vui lòng thử lại sau.'));
      })
    );
  }
}