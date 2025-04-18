import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface Seat {
  SeatStatusByShowTimeId: string;
  SeatId: string;
  Status: number;
  SeatPrice: number;
  SeatName: string;
  RowNumber: number;
  ColNumber: number;
  SeatTypeName: string;
  PairId: string | null;
  isSelected?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: WebSocket | null = null;
  private seatsSubject = new BehaviorSubject<Seat[]>([]);
  public seats$ = this.seatsSubject.asObservable();
  private mockData: boolean = false; // Bật/tắt dữ liệu mẫu

  constructor() { }

  // Kết nối WebSocket
  connect(showtimeId: string, userId: string): void {
    if (this.mockData) {
      // console.log('Using mock seat data instead of WebSocket');
      setTimeout(() => {
        this.seatsSubject.next(this.generateMockSeats(showtimeId));
      }, 1500);
      return;
    }
    
    if (this.socket) {
      this.socket.close();
    }

    // Tạo kết nối WebSocket mới - chú ý tham số roomId trong URL thực chất là showtimeId
    this.socket = new WebSocket(`wss://localhost:7105/ws/KeepSeat?roomId=${showtimeId}&userId=${userId}`);

    // Xử lý khi kết nối mở
    this.socket.onopen = () => {
      console.log('WebSocket connected: showtimeId=' + showtimeId);
      
      // Gửi tin nhắn để lấy danh sách ghế
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        console.log('Sending GetList action to WebSocket');
        this.socket.send(JSON.stringify({
          Action: "GetList"
        }));
      }
    };

    // Xử lý khi nhận được dữ liệu
    this.socket.onmessage = (event) => {
      try {
        // Log data type để debug
        console.log('[WebSocket] Received data type:', typeof event.data);
        
        const data = JSON.parse(event.data);
        
        // Kiểm tra cấu trúc dữ liệu API trả về
        if (data && data.Seats && Array.isArray(data.Seats)) {
          console.log(`[WebSocket] Received all seats: ${data.Seats.length} items`);
          
          // Kiểm tra các loại trạng thái ghế nhận được từ server
          const selectedSeats = data.Seats.filter((s: Seat) => s.Status === this.SEAT_STATUS.SELECTED);
          const busySeats = data.Seats.filter((s: Seat) => s.Status === this.SEAT_STATUS.BUSY);
          
          if (selectedSeats.length > 0) {
            console.log(`[WebSocket] Found ${selectedSeats.length} SELECTED seats:`, 
              selectedSeats.map((s: Seat) => `${s.SeatName}(Status=${s.Status})`).join(', '));
          }
          
          if (busySeats.length > 0) {
            console.log(`[WebSocket] Found ${busySeats.length} BUSY seats:`, 
              busySeats.map((s: Seat) => `${s.SeatName}(Status=${s.Status})`).join(', '));
          }
          
          // Cập nhật trực tiếp từ server
          this.seatsSubject.next(data.Seats);
          
        } else if (Array.isArray(data)) {
          console.log(`[WebSocket] Received seats array: ${data.length} items`);
          
          // Cập nhật trực tiếp từ server
          this.seatsSubject.next(data);
          
        } else if (data && data.SeatId) {
          // Log chi tiết về cập nhật ghế đơn
          const statusText = data.Status === this.SEAT_STATUS.SELECTED ? "SELECTED(1)" : 
                             data.Status === this.SEAT_STATUS.AVAILABLE ? "AVAILABLE(0)" :
                             data.Status === this.SEAT_STATUS.BUSY ? "BUSY(4)" : data.Status;
                             
          console.log(`[WebSocket] Single seat update: ${data.SeatName || data.SeatId}, Status=${statusText}`);
          
          // Cập nhật ghế trong danh sách hiện tại
          const currentSeats = this.seatsSubject.getValue();
          const updatedSeats = currentSeats.map((s: Seat) => {
            if (s.SeatId === data.SeatId) {
              const oldStatus = s.Status;
              const oldStatusText = oldStatus === this.SEAT_STATUS.SELECTED ? "SELECTED(1)" : 
                                   oldStatus === this.SEAT_STATUS.AVAILABLE ? "AVAILABLE(0)" :
                                   oldStatus === this.SEAT_STATUS.BUSY ? "BUSY(4)" : oldStatus;
                                   
              console.log(`[WebSocket] Updating seat ${s.SeatName}: Status ${oldStatusText} -> ${statusText}`);
              return {...s, ...data};
            }
            return s;
          });
          
          this.seatsSubject.next(updatedSeats);
        } else {
          console.warn('[WebSocket] Unexpected data format:', data);
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing data:', error);
      }
    };

    // Xử lý khi kết nối đóng
    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    // Xử lý lỗi
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Chuyển sang dữ liệu mẫu nếu không kết nối được
      console.log('Falling back to mock data');
      setTimeout(() => {
        this.seatsSubject.next(this.generateMockSeats(showtimeId));
      }, 1000);
    };
  }

  // Ngắt kết nối WebSocket
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  // Gửi yêu cầu chọn/hủy chọn ghế
  toggleSeatSelection(seat: Seat): void {
    if (this.mockData || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log(`[MOCK] Toggling seat ${seat.SeatName} to Status=${seat.Status}`);
      
      // Cập nhật trạng thái ghế trong dữ liệu mẫu
      const currentSeats = this.seatsSubject.getValue();
      const updatedSeats = currentSeats.map(s => {
        if (s.SeatId === seat.SeatId) {
          return {...s, Status: seat.Status};
        }
        return s;
      });
      
      this.seatsSubject.next(updatedSeats);
      return;
    }
    
    try {
      // Hiển thị trạng thái mới đang gửi đi
      const statusText = seat.Status === this.SEAT_STATUS.SELECTED ? "SELECTED(1)" : 
                         seat.Status === this.SEAT_STATUS.AVAILABLE ? "AVAILABLE(0)" : seat.Status;
      
      // Ghi chú quan trọng về trạng thái ghế
      console.log(`[WEBSOCKET SEND] Seat ${seat.SeatName}: Status=${statusText}, SeatStatusByShowTimeId=${seat.SeatStatusByShowTimeId}`);
      console.log(`[NOTE] Khi chọn ghế (Status=1), server có thể trả về Status=4 (BUSY)`);
      
      // Gửi tin nhắn cập nhật trạng thái với SeatStatusByShowTimeId thay vì SeatId
      const updateRequest = {
        Action: "UpdateStatus",
        SeatStatusUpdateRequests: [
          {
            SeatId: seat.SeatStatusByShowTimeId, // Quan trọng: Sử dụng SeatStatusByShowTimeId thay vì SeatId
            Status: seat.Status
          }
        ]
      };
      
      // Ghi log chi tiết request để debug
      console.log('[WEBSOCKET SEND] Request:', JSON.stringify(updateRequest));
      
      // Gửi yêu cầu đến server
      this.socket.send(JSON.stringify(updateRequest));
    } catch (error) {
      console.error('[WebSocket] Error sending WebSocket message:', error);
    }
  }

  // Định nghĩa các trạng thái ghế
  public readonly SEAT_STATUS = {
    AVAILABLE: 0,        // Ghế trống, có thể chọn
    SELECTED: 1,         // Ghế đang được chọn
    UNAVAILABLE: 3,      // Ghế không khả dụng
    BUSY: 4,             // Ghế đang được giữ
    BOOKED: 5            // Ghế đã đặt
  };

  // Tạo dữ liệu ghế mẫu cho mục đích test
  private generateMockSeats(showtimeId: string): Seat[] {
    const seats: Seat[] = [];
    const rows = 8;
    const cols = 12;
    
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= cols; col++) {
        // Tạo id ghế
        const seatId = `seat-${row}-${col}-${Math.random().toString(36).substring(2, 10)}`;
        
        // Xác định loại ghế
        let seatType = 'Ghế thường';
        if (row >= 5 && row <= 7) {
          seatType = 'Ghế VIP';
        }
        
        // Xác định giá ghế
        let price = 90000;
        if (seatType === 'Ghế VIP') {
          price = 120000;
        }
        
        // Xác định trạng thái ghế (ngẫu nhiên)
        let status = this.SEAT_STATUS.AVAILABLE;
        const rand = Math.random();
        
        if (rand < 0.2) {
          status = this.SEAT_STATUS.BOOKED; // 20% ghế đã đặt
        } else if (rand < 0.25) {
          status = this.SEAT_STATUS.BUSY; // 5% ghế đang được giữ
        }
        
        // Tạo ghế đôi ở hàng cuối
        let pairId = null;
        if (row === 8 && col % 2 === 1 && col < cols) {
          const nextSeatId = `seat-${row}-${col+1}-${Math.random().toString(36).substring(2, 10)}`;
          pairId = nextSeatId;
          seatType = 'Ghế đôi';
          price = 160000;
          
          // Thêm ghế tiếp theo trong cặp ghế đôi
          seats.push({
            SeatStatusByShowTimeId: showtimeId,
            SeatId: nextSeatId,
            Status: status,
            SeatPrice: price,
            SeatName: `${String.fromCharCode(64 + row)}${col+1}`,
            RowNumber: row,
            ColNumber: col+1,
            SeatTypeName: seatType,
            PairId: seatId
          });
        }
        
        seats.push({
          SeatStatusByShowTimeId: showtimeId,
          SeatId: seatId,
          Status: status,
          SeatPrice: price,
          SeatName: `${String.fromCharCode(64 + row)}${col}`,
          RowNumber: row,
          ColNumber: col,
          SeatTypeName: seatType,
          PairId: pairId
        });
      }
    }
    
    console.log(`Generated ${seats.length} mock seats`);
    return seats;
  }
}
