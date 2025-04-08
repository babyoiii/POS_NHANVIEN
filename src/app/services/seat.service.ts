import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { SeatInfo } from '../models/SeatModel';

export interface SeatStatusUpdateRequest {
  SeatId: string;
  Status: number;
}

export interface WebSocketMessage {
  Action?: string;
  i?: number;
  SeatStatusUpdateRequests?: SeatStatusUpdateRequest[];
}

@Injectable({
  providedIn: 'root'
})
export class SeatService {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<SeatInfo[]>();
  private joinRoomSubject = new BehaviorSubject<number | null>(null);
  private seats: SeatInfo[] = [];
  private isConnected = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 3000; // 3 giây
  private connectionTimeout = 10000; // 10 giây
  private connectionTimer: any;

  constructor() {
    this.restoreCountdownFromStorage();
    this.restoreConnection();
  }

  private restoreCountdownFromStorage() {
    const storedCountdown = localStorage.getItem('roomCountdown');
    if (storedCountdown) {
      const countdown = parseInt(storedCountdown, 10);
      if (!isNaN(countdown)) {
        console.log('🔄 Khôi phục countdown từ storage:', countdown);
        this.joinRoomSubject.next(countdown);
      }
    }
  }

  private restoreConnection() {
    const savedConnection = localStorage.getItem('websocketConnection');
    if (savedConnection) {
      const { roomId, userId } = JSON.parse(savedConnection);
      this.currentRoomId = roomId;
      this.currentUserId = userId;
      this.connect(roomId, userId);
    }
  }

  private saveConnection(roomId: string, userId: string) {
    localStorage.setItem('websocketConnection', JSON.stringify({ roomId, userId }));
  }

  private setupConnectionTimeout() {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
    }
    this.connectionTimer = setTimeout(() => {
      if (!this.isConnected) {
        console.log('⚠️ Kết nối timeout, thử kết nối lại...');
        this.handleConnectionError();
      }
    }, this.connectionTimeout);
  }

  private handleConnectionError() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      setTimeout(() => {
        if (this.currentRoomId && this.currentUserId) {
          this.connect(this.currentRoomId, this.currentUserId);
        }
      }, this.reconnectTimeout);
    } else {
      this.clearConnection();
    }
  }

  connect(roomId: string, userId: string): void {
    // Nếu đã kết nối với cùng roomId và userId, không cần kết nối lại
    if (this.isConnected && this.currentRoomId === roomId && this.currentUserId === userId) {
      console.log('✅ WebSocket đã được kết nối với cùng roomId và userId');
      return;
    }

    // Nếu đang có kết nối với roomId hoặc userId khác, đóng kết nối cũ
    if (this.isConnected) {
      console.log('🔄 Đóng kết nối cũ trước khi tạo kết nối mới');
      this.close();
    }

    this.currentRoomId = roomId;
    this.currentUserId = userId;
    this.saveConnection(roomId, userId);
    this.reconnectAttempts = 0;

    // Đợi một chút để đảm bảo kết nối cũ đã đóng hoàn toàn
    setTimeout(() => {
      const wsUrl = `wss://localhost:7105/ws/KeepSeat?roomId=${roomId}&userId=${userId}`;
      this.socket = new WebSocket(wsUrl);

      this.setupConnectionTimeout();

      this.socket.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        if (this.connectionTimer) {
          clearTimeout(this.connectionTimer);
        }
        
        // Thêm delay nhỏ trước khi gửi tin nhắn
        setTimeout(() => {
          this.getList();
          this.joinRoom();
        }, 100);
      };

      this.socket.onmessage = (event) => this.handleMessage(event.data);
      
      this.socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected = false;
        this.handleConnectionError();
      };

      this.socket.onclose = (event) => {
        console.log('🔴 WebSocket disconnected', event);
        this.isConnected = false;
        if (!event.wasClean) {
          this.handleConnectionError();
        }
      };
    }, 100); // Đợi 100ms trước khi tạo kết nối mới
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      // Xử lý countdown
      if (message.i !== undefined) {
        this.updateCountdown(message.i);

        // Nếu chỉ có countdown thì return
        if (Object.keys(message).length === 1) {
          return;
        }
      }

      // Xử lý danh sách ghế
      if (this.isSeatUpdate(message)) {
        console.log('🔄 Cập nhật trạng thái ghế');
        this.updateSeatStatus(message.SeatStatusUpdateRequests || []);
      } else if (Array.isArray(message)) {
        this.seats = message;
        this.messageSubject.next([...this.seats]);
      } else if (typeof message === 'object' && message !== null) {
        this.seats = Object.values(message) as SeatInfo[];
        this.messageSubject.next([...this.seats]);
      }
    } catch (error) {
      console.error('❌ Lỗi xử lý dữ liệu:', error);
    }
  }

  private updateCountdown(countdown: number) {
    // Lưu countdown vào localStorage
    localStorage.setItem('roomCountdown', countdown.toString());
    this.joinRoomSubject.next(countdown);
    // Xóa 'selectedSeats' khi countdown kết thúc
    if (countdown <= 0) {
        console.log('🧹 Countdown kết thúc, xóa selectedSeats khỏi localStorage');
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
    console.log('🔄 Đang cập nhật trạng thái ghế:', updates);
    
    updates.forEach(({ SeatId, Status }) => {
      const seat = this.seats.find(s => s.SeatStatusByShowTimeId === SeatId);
      if (seat) {
        seat.Status = Status;
        console.log(`✅ Ghế ${SeatId} đã được cập nhật thành ${Status}`);
      } else {
        console.warn(`⚠️ Không tìm thấy ghế với ID: ${SeatId}`);
      }
    });
  }

  // Các phương thức gửi tin nhắn
  sendMessage(action: string, data?: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ Action: action, ...data }));
    } else {
      console.error(`❌ Không thể gửi ${action}, WebSocket chưa kết nối.`);
    }
  }

  getList(): void {
    this.sendMessage('GetList');
  }
  joinRoom(): void {
    this.sendMessage('JoinRoom');
  }

  updateStatus(seats: SeatStatusUpdateRequest[]): void {
    if (!seats || seats.length === 0) {
      console.warn('⚠️ Không có ghế nào để cập nhật.');
      return;
    }

    const requestData = {
      Action: 'UpdateStatus',
      SeatStatusUpdateRequests: seats
    };

    this.sendMessage('UpdateStatus', requestData);
  }

  // Observable để lấy danh sách ghế
  getMessages(): Observable<SeatInfo[]> {
    return this.messageSubject.asObservable();
  }

  // Observable để lấy countdown
  getJoinRoomMessages(): Observable<number | null> {
    return this.joinRoomSubject.asObservable();
  }

  // Thêm phương thức để reset countdown
  resetCountdown() {
    localStorage.removeItem('roomCountdown');
    this.joinRoomSubject.next(null);
  }

  close(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  // Thêm phương thức để xóa kết nối khi cần
  clearConnection() {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
    }
    localStorage.removeItem('websocketConnection');
    this.close();
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
      console.log('WebSocket connection disconnected');
    }
 
  }

  // Add the payment method to handle the payment status update
  payment(seats: SeatStatusUpdateRequest[]): void {
    if (!seats || seats.length === 0) {
      console.warn('⚠️ Không có ghế nào để cập nhật.');
      return;
    }

    const requestData = {
      Action: 'Payment',
      SeatStatusUpdateRequests: seats
    };

    this.sendMessage('Payment', requestData);
  }
}
