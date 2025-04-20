import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { WebsocketService, SeatStatus, SeatStatusUpdateRequest } from './websocket.service';
import { SeatInfo } from '../models/SeatModel';

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
    return this.http.post<ApiResponse>(`${this.apiUrl}/api/Counter/Booking/Payment`, {
      orderCode,
      userId
    }).pipe(
      tap((response: ApiResponse) => {
        if (response.responseCode === 200) {
          // Sau khi thanh toán thành công, lấy thông tin đơn hàng để cập nhật ghế
          this.getOrderInfo(orderCode).subscribe((orderInfo: OrderInfoResponse) => {
            this.updateSeatStatusAfterPayment(orderInfo);
          });
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
    return this.http.get<OrderInfoResponse>(`${this.apiUrl}/api/Counter/Booking/GetOrderInfo/${orderCode}`)
      .pipe(catchError(error => {
        console.error('Error getting order info:', error);
        return throwError(() => error);
      }));
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
      if (orderInfo.responseCode === 200 && orderInfo.tickets && orderInfo.tickets.length > 0) {
        const seatUpdates: SeatStatusUpdateRequest[] = [];
        let showtimeId = '';
        
        // Lấy thông tin showtime từ ticket đầu tiên với xử lý các trường hợp khác nhau
        const firstTicket = orderInfo.tickets[0];
        if (firstTicket.showTimeId) {
          showtimeId = firstTicket.showTimeId;
        } else if (firstTicket.ShowTimeId) {
          showtimeId = firstTicket.ShowTimeId;
        }
        
        // Đảm bảo có kết nối WebSocket trước khi cập nhật trạng thái ghế
        if (showtimeId) {
          this.ensureWebSocketConnection(showtimeId, orderInfo.userId || 'counter-user')
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
                  console.log(`Sending WebSocket update for ${seatUpdates.length} seats`);
                  this.websocketService.updateStatus(seatUpdates);
                }
              }
            });
        } else {
          console.error('No showTimeId found in ticket data');
        }
      }
    } catch (error) {
      console.error('Error updating seat status:', error);
    }
  }
  
  // Đảm bảo rằng WebSocket đã được kết nối trước khi thực hiện thao tác
  private ensureWebSocketConnection(showtimeId: string, userId: string): Observable<boolean> {
    const connectionKey = `${showtimeId}-${userId}`;
    
    if (this.wsConnectionMap.get(connectionKey)) {
      return of(true); // Đã kết nối
    }
    
    try {
      // Thiết lập kết nối WebSocket mới
      this.websocketService.connect(showtimeId, userId);
      this.wsConnectionMap.set(connectionKey, true);
      return of(true);
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      return of(false);
    }
  }
} 