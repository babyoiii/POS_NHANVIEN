import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { SeatInfo } from '../models/SeatModel';

// Định nghĩa các trạng thái ghế để dùng trong code
export enum SeatStatus {
  AVAILABLE = 0,
  SELECTED = 1,
  UNAVAILABLE = 3,
  BUSY = 4,
  BOOKED = 5
}

export interface SeatStatusUpdateRequest {
  SeatId: string;
  Status: number;
}

export interface WebSocketMessage {
  Action?: string;
  i?: number;
  SeatStatusUpdateRequests?: SeatStatusUpdateRequest[];
  Seats?: SeatInfo[];
}

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  // Hằng số cho URL WebSocket
  private readonly WS_BASE_URL = 'wss://localhost:7105/ws/KeepSeat';
  
  // Bật debug để hiển thị log chi tiết
  private readonly DEBUG = false;
  
  private webSocket: WebSocket | null = null;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;
  private reconnectInterval = 3000; // 3 seconds
  private reconnectTimeoutId: any = null;
  private messageSubject = new Subject<SeatInfo[]>();
  private seatsUpdatedSubject = new Subject<SeatInfo[]>();
  private seats: SeatInfo[] = [];
  private isConnected = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private reconnectAttempts = 0; // Legacy, for compatibility

  constructor() {
    this.restoreConnection();
  }

  private restoreConnection() {
    const savedConnection = localStorage.getItem('websocketConnection');
    if (savedConnection) {
      try {
        const { roomId, userId } = JSON.parse(savedConnection);
        this.currentRoomId = roomId;
        this.currentUserId = userId;
        this.connect(roomId, userId);
      } catch (error) {
        localStorage.removeItem('websocketConnection');
      }
    }
  }

  private saveConnection(roomId: string, userId: string) {
    localStorage.setItem('websocketConnection', JSON.stringify({ roomId, userId }));
  }

  public connectWebSocket(showtimeId: string, userId: string): void {
    this.closeWebSocketIfExists();
    
    // Chuyển ID thành chữ hoa để đảm bảo định dạng giống như URL mẫu
    const roomIdUpper = showtimeId.toUpperCase();
    const userIdUpper = userId.toUpperCase();
    
    // Sử dụng URL cố định cho WebSocket với đúng cấu trúc
    const wsUrl = `${this.WS_BASE_URL}?roomId=${roomIdUpper}&userId=${userIdUpper}`;

    
    try {
      this.webSocket = new WebSocket(wsUrl);
      this.connectionAttempts = 0;

      this.webSocket.onopen = () => {
        this.isConnected = true;
        this.connectionAttempts = 0; 

        this.getList(showtimeId);
        
        // Thiết lập ping định kỳ để giữ kết nối
        this.setupPingInterval();
      };

      this.webSocket.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          
          if (data.Seats) {
            this.seats = data.Seats;
            this.seatsUpdatedSubject.next(data.Seats);
            this.messageSubject.next(data.Seats);
          } else if (data.SeatStatusUpdateRequests) {
            // Cập nhật trạng thái ghế ngay lập tức
            this.updateSeatStatus(data.SeatStatusUpdateRequests);
            // Sau đó lấy lại danh sách đầy đủ
            this.getList(showtimeId);
          } else {
            this.handleMessage(event.data);
          }
        } catch (error) {

          // Refresh data on error
          this.getList(showtimeId);
        }
      };

      this.webSocket.onerror = (error) => {

        this.isConnected = false;
        this.attemptReconnect(showtimeId, userId);
      };

      this.webSocket.onclose = (event) => {

        this.isConnected = false;
        this.attemptReconnect(showtimeId, userId);
      };
      
      // Thêm timeout để kiểm tra nếu kết nối không thành công trong 5 giây
      setTimeout(() => {
        if (this.webSocket && this.webSocket.readyState !== WebSocket.OPEN) {

          if (this.webSocket.readyState === WebSocket.CONNECTING) {
            this.webSocket.close();
            this.webSocket = null;
            this.attemptReconnect(showtimeId, userId);
          }
        }
      }, 5000);
      
    } catch (error) {

      this.attemptReconnect(showtimeId, userId);
    }
  }

  private attemptReconnect(showtimeId: string, userId: string): void {
    if (this.connectionAttempts < this.maxConnectionAttempts) {
      this.connectionAttempts++;
      
      // Clear any existing reconnect timeout
      if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
      }
      
      this.reconnectTimeoutId = setTimeout(() => {
        this.connectWebSocket(showtimeId, userId);
      }, this.reconnectInterval);
    } else {
      // Emit an event that the connection failed permanently
      this.onConnectionFailed.next();
    }
  }

  private closeWebSocketIfExists(): void {
    if (this.webSocket) {
      this.webSocket.onclose = null; // Prevent triggering reconnect on intentional close
      this.webSocket.close();
      this.webSocket = null;
    }
    
    // Clear any pending reconnect attempts
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  connect(roomId: string, userId: string): void {
    // Luôn chuyển ID thành chữ hoa để khớp với định dạng yêu cầu
    const roomIdUpper = roomId.toUpperCase();
    const userIdUpper = userId.toUpperCase();
    

    
    if (this.isConnected && this.currentRoomId === roomIdUpper && this.currentUserId === userIdUpper) {

      return;
    }

    if (this.isConnected) {

      this.close();
    }

    this.currentRoomId = roomIdUpper;
    this.currentUserId = userIdUpper;
    this.saveConnection(roomIdUpper, userIdUpper);
    
    // Kết nối WebSocket
    this.connectWebSocket(roomIdUpper, userIdUpper);
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      if (message.i !== undefined) {
        this.updateCountdown(message.i);

        if (Object.keys(message).length === 1) {
          return;
        }
      }

      if (this.isSeatUpdate(message)) {
        this.updateSeatStatus(message.SeatStatusUpdateRequests || []);
        // Sau khi cập nhật trạng thái từng ghế, gọi getList để lấy lại toàn bộ dữ liệu ghế
        this.getList(this.currentRoomId || undefined);
      } else if (Array.isArray(message)) {
        this.seats = message;
        this.messageSubject.next([...this.seats]);
      } else if (typeof message === 'object' && message !== null) {
        // Kiểm tra nếu có thuộc tính Seats trước
        if (message.Seats && Array.isArray(message.Seats)) {
          this.seats = message.Seats;
          this.messageSubject.next([...this.seats]);
        } else {
          try {
            // Thử chuyển đổi object thành danh sách ghế
            this.seats = Object.values(message) as SeatInfo[];
            if (this.seats.length > 0 && this.seats[0].SeatId) {
              this.messageSubject.next([...this.seats]);
            }
          } catch (conversionError) {
            // Silent error
          }
        }
      }
    } catch (error) {

      // Gọi getList trong trường hợp lỗi xử lý để đảm bảo dữ liệu luôn được cập nhật
      this.getList(this.currentRoomId || undefined);
    }
  }

  private updateCountdown(countdown: number) {
    localStorage.setItem('roomCountdown', countdown.toString());
    if (countdown <= 0) {
      localStorage.removeItem('selectedSeats');
      this.getList();
    }
  }

  private isSeatUpdate(message: WebSocketMessage): boolean {
    const action = message.Action?.toLowerCase();
    return action === 'updatestatus' &&
      Array.isArray(message.SeatStatusUpdateRequests);
  }

  private updateSeatStatus(updates: SeatStatusUpdateRequest[]): void {
    let hasUpdates = false;
    updates.forEach(({ SeatId, Status }) => {
      // Tìm ghế bằng SeatStatusByShowTimeId
      const seat = this.seats.find(s => s.SeatStatusByShowTimeId === SeatId);
      if (seat) {
        seat.Status = Status;
        hasUpdates = true;
      }
    });
    
    // Thông báo cập nhật
    if (hasUpdates) {
      this.messageSubject.next([...this.seats]);
      this.seatsUpdatedSubject.next([...this.seats]);
    }
  }

  sendMessage(action: string, data?: any): void {
    if (!this.webSocket) {

      // Thử kết nối lại nếu đang mất kết nối
      if (this.currentRoomId && this.currentUserId) {

        this.connectWebSocket(this.currentRoomId, this.currentUserId);
        // Lưu tin nhắn để gửi sau khi kết nối
        setTimeout(() => {
          if (this.isConnected) {

            this.sendMessage(action, data);
          } else {

          }
        }, 1000);
      }
      return;
    }
    
    if (this.webSocket.readyState === WebSocket.OPEN) {
      // Tạo message để gửi đi
      const message = JSON.stringify({ 
        Action: action, 
        ...data 
      });
      

      
      try {
        this.webSocket.send(message);

      } catch (error) {

      }
    } else {

      // Nếu WebSocket đang kết nối (readyState === 0), thì chờ và thử lại
      if (this.webSocket.readyState === WebSocket.CONNECTING) {

        setTimeout(() => {
          this.sendMessage(action, data);
        }, 1000);
      }
    }
  }

  getList(showtimeId?: string): void {
    if (showtimeId) {
      this.sendMessage('GetList', { showtimeId });
    } else {
      this.sendMessage('GetList');
    }
  }

  updateStatus(seats: SeatStatusUpdateRequest[]): void {
    if (!seats || seats.length === 0) {
      return;
    }

    const requestData = {
      SeatStatusUpdateRequests: seats
    };

    this.sendMessage('UpdateStatus', requestData);
  }

  getMessages(): Observable<SeatInfo[]> {
    return this.messageSubject.asObservable();
  }

  get seatsUpdated$(): Observable<SeatInfo[]> {
    return this.seatsUpdatedSubject.asObservable();
  }

  close(): void {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    
    this.isConnected = false;
  }

  clearConnection() {
    localStorage.removeItem('websocketConnection');
    this.close();
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isConnected = false;
  }

  disconnect(): void {
    this.close();
  }

  payment(seats: SeatStatusUpdateRequest[]): void {
    if (!seats || seats.length === 0) {

      return;
    }

    // Log chi tiết ghế cần cập nhật

    
    const requestData = {
      SeatStatusUpdateRequests: seats
    };

    // Kiểm tra kết nối WebSocket
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {

      
      // Thử kết nối lại nếu cần
      if (this.currentRoomId && this.currentUserId) {

        this.connectWebSocket(this.currentRoomId, this.currentUserId);
        
        // Thử gửi lại sau khi kết nối
        setTimeout(() => {
          if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {

            this.sendMessage('Payment', requestData);
          } else {

          }
        }, 1000);
      }
      return;
    }

    // Gửi tin nhắn Payment

    this.sendMessage('Payment', requestData);
  }

  private onConnectionFailed = new Subject<void>();
  public connectionFailed$ = this.onConnectionFailed.asObservable();

  // Thiết lập ping định kỳ để giữ kết nối WebSocket
  private pingIntervalId: any = null;
  
  private setupPingInterval() {
    // Hủy interval hiện tại nếu có
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
    }
    
    // Tạo interval mới để ping mỗi 30 giây
    this.pingIntervalId = setInterval(() => {
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        this.sendMessage('Ping');
      }
    }, 30000); // 30 giây
  }
}