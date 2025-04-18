import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { WebsocketService, Seat } from '../../../services/websocket.service';
import { Subscription } from 'rxjs';

interface SeatingRow {
  rowName: string;
  rowNumber: number;
  seats: Seat[];
}

@Component({
  selector: 'app-seat-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seat-map.component.html',
  styleUrl: './seat-map.component.css'
})
export class SeatMapComponent implements OnInit, OnDestroy {
  showtimeId: string = '';
  seats: Seat[] = [];
  seatingRows: SeatingRow[] = [];
  selectedSeats: Seat[] = [];
  totalPrice: number = 0;
  maxCols: number = 0;
  isPreorder: boolean = false; // Cờ đánh dấu là đặt vé trước
  validationMessage: string = ''; // Thông báo lỗi validation
  private subscriptions: Subscription = new Subscription();
  
  // Tạo người dùng mẫu - sẽ được thay thế bằng người dùng thực tế sau
  private userId: string = localStorage.getItem('userId') || 'c7b7ec11-add5-4d71-bae9-d72ea84e88e5';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private websocketService: WebsocketService
  ) {}

  ngOnInit(): void {
    console.log('SeatMap component initialized');
    this.route.queryParams.subscribe(queryParams => {
      this.isPreorder = queryParams['isPreorder'] === 'true';
      console.log(`Is preorder booking: ${this.isPreorder}`);
    });
    
    this.route.params.subscribe(params => {
      this.showtimeId = params['showtimeId'];
      if (this.showtimeId) {
        console.log(`Loading seat map for showtime ID: ${this.showtimeId}`);
        // Kết nối WebSocket khi có showtimeId
        this.connectWebSocket();
      }
    });
  }

  ngOnDestroy(): void {
    // Ngắt kết nối WebSocket khi rời khỏi component
    console.log('SeatMap component destroyed, closing WebSocket');
    this.websocketService.disconnect();
    this.subscriptions.unsubscribe();
  }

  connectWebSocket(): void {
    // Kết nối tới WebSocket
    this.websocketService.connect(this.showtimeId, this.userId);
    
    // Đăng ký lắng nghe dữ liệu ghế
    const seatsSub = this.websocketService.seats$.subscribe(seats => {
      this.seats = seats;
      if (seats.length > 0) {
        // Chỉ log khi nhận được ghế lần đầu
        if (!this.seatingRows || this.seatingRows.length === 0) {
          console.log(`Organizing ${seats.length} seats into rows`);
        }
      }
      this.organizeSeats();
      
      // Cập nhật danh sách ghế đã chọn dựa trên dữ liệu từ server
      this.selectedSeats = seats.filter(seat => seat.Status === this.websocketService.SEAT_STATUS.SELECTED);
      
      // Tính lại tổng tiền
      this.calculateTotalPrice();
    });
    
    this.subscriptions.add(seatsSub);
  }

  organizeSeats(): void {
    if (!this.seats || this.seats.length === 0) return;
    
    // console.log('Organizing seats, sample seat:', this.seats[0]);
    
    // Tìm số cột lớn nhất
    this.maxCols = Math.max(...this.seats.map(seat => seat.ColNumber));
    
    // Tạo Map lưu trữ hàng ghế
    const rowMap = new Map<number, SeatingRow>();
    
    // Lặp qua từng ghế để tổ chức vào hàng
    this.seats.forEach(seat => {
      if (!rowMap.has(seat.RowNumber)) {
        // Tạo hàng mới nếu chưa tồn tại
        rowMap.set(seat.RowNumber, {
          rowName: this.getRowName(seat.RowNumber),
          rowNumber: seat.RowNumber,
          seats: []
        });
      }
      
      // Thêm ghế vào hàng tương ứng
      const row = rowMap.get(seat.RowNumber);
      if (row) {
        row.seats.push(seat);
      }
    });
    
    // Sắp xếp hàng ghế theo thứ tự tăng dần của rowNumber
    this.seatingRows = Array.from(rowMap.values())
      .sort((a, b) => a.rowNumber - b.rowNumber);
    
    // Sắp xếp ghế trong mỗi hàng theo số cột
    this.seatingRows.forEach(row => {
      row.seats.sort((a, b) => a.ColNumber - b.ColNumber);
    });

    if (this.seatingRows.length > 0) {
      console.log(`Created ${this.seatingRows.length} rows with max ${this.maxCols} columns`);
      // console.log('First row seats:', this.seatingRows[0].seats.map(s => s.SeatName).join(', '));
    }
  }

  getRowName(rowNumber: number): string {
    // Chuyển số hàng thành ký tự (1 -> A, 2 -> B, ...)
    return String.fromCharCode(64 + rowNumber);
  }

  // Lấy tên của ghế đôi đi kèm
  getPairedSeatName(seat: Seat): string {
    if (!seat.PairId) return '';
    const pairedSeat = this.seats.find(s => s.SeatId === seat.PairId);
    return pairedSeat ? pairedSeat.SeatName : '';
  }

  isSeatSelectable(seat: Seat): boolean {
    // Ghế có thể chọn nếu trạng thái là AVAILABLE (0)
    return seat.Status === this.websocketService.SEAT_STATUS.AVAILABLE;
  }

  getSeatClass(seat: Seat): string {
    let classes = 'seat';
    
    // Áp dụng class dựa trên loại ghế
    if (seat.SeatTypeName.toLowerCase().includes('vip')) {
      classes += ' vip-seat';
    } else if (seat.SeatTypeName.toLowerCase().includes('đôi') || seat.PairId) {
      classes += ' couple-seat';
    }
    
    // Áp dụng class dựa trên trạng thái ghế
    if (seat.Status === this.websocketService.SEAT_STATUS.BOOKED) {
      classes += ' booked';
    } else if (seat.Status === this.websocketService.SEAT_STATUS.BUSY) {
      classes += ' reserved';
    } else if (seat.Status === this.websocketService.SEAT_STATUS.UNAVAILABLE) {
      classes += ' unavailable';
    } else if (seat.Status === this.websocketService.SEAT_STATUS.SELECTED || this.isSelected(seat)) {
      classes += ' selected';
    }
    
    return classes;
  }

  isSelected(seat: Seat): boolean {
    // Ghế được coi là đã chọn nếu trạng thái là SELECTED hoặc có trong danh sách selectedSeats
    return seat.Status === this.websocketService.SEAT_STATUS.SELECTED || 
           this.selectedSeats.some(s => s.SeatId === seat.SeatId);
  }

  // Kiểm tra xem việc chọn ghế có hợp lệ không
  validateSeatSelection(seat: Seat): boolean {
    // Nếu đang bỏ chọn ghế, luôn hợp lệ
    if (this.isSelected(seat)) {
      return true;
    }

    // Tìm hàng của ghế đang chọn
    const rowSeats = this.seatingRows.find(row => row.rowNumber === seat.RowNumber)?.seats || [];
    if (rowSeats.length === 0) return true;

    // Lọc ra những ghế có thể chọn được trong hàng đó (trạng thái AVAILABLE hoặc đã được chọn)
    const selectableSeats = rowSeats.filter(s => 
      s.Status === this.websocketService.SEAT_STATUS.AVAILABLE || this.isSelected(s)
    );
    
    // Lọc ra những ghế đã được chọn trong hàng
    const selectedInRow = rowSeats.filter(s => this.isSelected(s));
    
    // Quy tắc 1: Không được bỏ trống ghế ở giữa
    if (selectedInRow.length > 0) {
      // Sắp xếp ghế theo cột
      const sortedSelected = [...selectedInRow, seat].sort((a, b) => a.ColNumber - b.ColNumber);
      
      // Kiểm tra xem có bỏ trống ghế ở giữa không
      for (let i = 0; i < sortedSelected.length - 1; i++) {
        const currentSeat = sortedSelected[i];
        const nextSeat = sortedSelected[i + 1];
        const gap = nextSeat.ColNumber - currentSeat.ColNumber - 1;
        
        // Nếu có ghế trống ở giữa
        if (gap > 0) {
          // Kiểm tra xem ghế trống đó có thể chọn được không (không phải đã đặt, không khả dụng hoặc đang giữ)
          const seatsInGap = rowSeats.filter(s => 
            s.ColNumber > currentSeat.ColNumber && 
            s.ColNumber < nextSeat.ColNumber &&
            (s.Status === this.websocketService.SEAT_STATUS.BOOKED || 
             s.Status === this.websocketService.SEAT_STATUS.BUSY ||
             s.Status === this.websocketService.SEAT_STATUS.UNAVAILABLE)
          );
          
          // Nếu không phải tất cả ghế trong khoảng trống đều đã được đặt/giữ/không khả dụng, thì không hợp lệ
          if (seatsInGap.length < gap) {
            this.validationMessage = 'Không được bỏ trống ghế ở giữa!';
            return false;
          }
        }
      }
    }
    
    // Quy tắc 2: Đối với đặt vé trước, phải chọn từ mép ngoài cùng
    if (this.isPreorder && selectedInRow.length === 0) {
      // Sắp xếp ghế có thể chọn theo cột
      const sortedSelectable = selectableSeats.sort((a, b) => a.ColNumber - b.ColNumber);
      
      // Kiểm tra xem ghế đang chọn có phải là ghế ngoài cùng bên trái hoặc phải không
      const isLeftmostSeat = seat.ColNumber === sortedSelectable[0].ColNumber;
      const isRightmostSeat = seat.ColNumber === sortedSelectable[sortedSelectable.length - 1].ColNumber;
      
      if (!isLeftmostSeat && !isRightmostSeat) {
        this.validationMessage = 'Khi đặt vé trước, bạn phải chọn ghế từ mép ngoài cùng!';
        return false;
      }
    }
    
    this.validationMessage = '';
    return true;
  }

  toggleSeat(seat: Seat): void {
    if (!this.isSeatSelectable(seat) && seat.Status !== this.websocketService.SEAT_STATUS.SELECTED) {
      return;
    }
    
    // Nếu đang bỏ chọn ghế đã chọn
    if (seat.Status === this.websocketService.SEAT_STATUS.SELECTED) {
      // Không cần kiểm tra validation khi bỏ chọn
      // console.log(`Unselecting seat ${seat.SeatName}`);
      this.selectedSeats = this.selectedSeats.filter(s => s.SeatId !== seat.SeatId);
      
      // Nếu là ghế đôi, hủy chọn ghế đi kèm
      if (seat.PairId) {
        this.selectedSeats = this.selectedSeats.filter(s => s.SeatId !== seat.PairId);
        // const pairedSeatName = this.getPairedSeatName(seat);
        // console.log(`Unselected paired seat ${pairedSeatName}`);
        
        // Tìm ghế đôi đi kèm
        const pairedSeat = this.seats.find(s => s.SeatId === seat.PairId);
        if (pairedSeat && pairedSeat.Status === this.websocketService.SEAT_STATUS.SELECTED) {
          // Gửi yêu cầu thay đổi trạng thái ghế đôi lên server
          this.websocketService.toggleSeatSelection(pairedSeat);
        }
      }
      
      // Gửi yêu cầu thay đổi trạng thái ghế lên server
      this.websocketService.toggleSeatSelection(seat);
      return;
    }
    
    // Kiểm tra tính hợp lệ khi chọn ghế
    if (!this.validateSeatSelection(seat)) {
      return;
    }
    
    // Nếu ghế chưa được chọn, tiến hành chọn
    // console.log(`Selecting seat ${seat.SeatName}`);
    
    // Nếu là ghế đôi, kiểm tra và chọn ghế đi kèm
    if (seat.PairId) {
      const pairedSeat = this.seats.find(s => s.SeatId === seat.PairId);
      if (pairedSeat && this.isSeatSelectable(pairedSeat)) {
        // console.log(`Auto-selecting paired seat ${pairedSeat.SeatName}`);
        // Gửi yêu cầu thay đổi trạng thái ghế đôi lên server
        this.websocketService.toggleSeatSelection(pairedSeat);
      }
    }
    
    // Gửi yêu cầu thay đổi trạng thái ghế lên server
    this.websocketService.toggleSeatSelection(seat);
  }

  calculateTotalPrice(): void {
    this.totalPrice = this.selectedSeats.reduce((total, seat) => total + seat.SeatPrice, 0);
    if (this.selectedSeats.length > 0) {
      console.log(`Total price for ${this.selectedSeats.length} seats: ${this.totalPrice} VND`);
    }
  }

  continueToFoodSelection(): void {
    // Lưu danh sách ghế đã chọn để sử dụng ở bước tiếp theo
    localStorage.setItem('selectedSeats', JSON.stringify(this.selectedSeats));
    console.log(`Saved ${this.selectedSeats.length} selected seats to localStorage`);
    
    // Điều hướng đến trang chọn đồ ăn
    // this.router.navigate(['/trangchu/doan'], { queryParams: { from: 'seat-map' } });
    
    // Thông báo chức năng đang được phát triển
    alert('Chức năng chọn đồ ăn đang được phát triển!');
  }

  goBack(): void {
    console.log('Navigating back to movie listing');
    this.router.navigate(['/trangchu/ticket/now']);
  }
}
