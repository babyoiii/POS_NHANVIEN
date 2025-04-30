import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { WebsocketService, SeatStatusUpdateRequest, SeatStatus } from '../../../services/websocket.service';
import { SeatInfo } from '../../../models/SeatModel';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

interface SeatingRow {
  rowName: string;
  rowNumber: number;
  seats: SeatInfo[];
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
  seats: SeatInfo[] = [];
  seatingRows: SeatingRow[] = [];
  selectedSeats: SeatInfo[] = [];
  totalPrice: number = 0;
  maxCols: number = 0;
  isPreorder: boolean = false; // Cờ đánh dấu là đặt vé trước
  validationMessage: string = ''; // Thông báo lỗi validation
  private subscriptions: Subscription = new Subscription();
  
  // Lấy userId từ user đã đăng nhập
  private userId: string = '';

  // Định nghĩa các trạng thái ghế
  readonly SEAT_STATUS = {
    AVAILABLE: 0,        // Ghế trống, có thể chọn
    SELECTED: 1,         // Ghế đang được chọn
    UNAVAILABLE: 3,      // Ghế không khả dụng
    BUSY: 4,             // Ghế đang được giữ
    BOOKED: 5            // Ghế đã đặt
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private seatService: WebsocketService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Lấy thông tin người dùng đã đăng nhập
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      // Sử dụng ID của user hiện tại cho WebSocket
      this.userId = currentUser.id.toString();
    } else {
      // Nếu không có user đăng nhập, điều hướng về trang đăng nhập
      this.router.navigate(['/login']);
      return;
    }
    
    this.route.queryParams.subscribe(queryParams => {
      this.isPreorder = queryParams['isPreorder'] === 'true';
    });
    
    this.route.params.subscribe(params => {
      this.showtimeId = params['showtimeId'];
      
      // Nếu không có showtimeId từ params, thử lấy từ localStorage
      if (!this.showtimeId) {
        const savedShowtimeId = localStorage.getItem('currentShowTimeId');
        if (savedShowtimeId) {
          console.log(`Recovered showTimeId from localStorage: ${savedShowtimeId}`);
          this.showtimeId = savedShowtimeId;
        } else {
          console.error('No showTimeId found in params or localStorage');
          // Điều hướng về trang danh sách phim
          this.router.navigate(['/trangchu/ticket/now']);
          return;
        }
      }
      
      // Lưu showTimeId vào localStorage để đảm bảo có thể truy cập sau khi quay lại
      localStorage.setItem('currentShowTimeId', this.showtimeId);
      
      // Kết nối WebSocket khi có showtimeId
      this.connectWebSocket();
    });

    // Thêm sự kiện lắng nghe khi người dùng rời khỏi trang
    window.addEventListener('beforeunload', this.handlePageUnload);
  }

  ngOnDestroy(): void {
    // Check if we're navigating to the food selection page
    // If we are, don't reset the seats
    const currentUrl = this.router.url;
    if (!currentUrl.includes('food')) {
      // Only reset seats if we're not navigating to food selection
    this.resetAllSelectedSeats();
    }
    
    // Ngắt kết nối WebSocket khi rời khỏi component
    console.log('SeatMap component destroyed, closing WebSocket');
    this.seatService.disconnect();
    this.subscriptions.unsubscribe();

    // Hủy đăng ký sự kiện
    window.removeEventListener('beforeunload', this.handlePageUnload);
  }

  // Xử lý khi người dùng rời khỏi trang
  private handlePageUnload = (event: BeforeUnloadEvent) => {
    // Check if we're navigating to the food selection page
    const currentUrl = this.router.url;
    if (!currentUrl.includes('food')) {
      // Only reset seats if we're not navigating to food selection
    this.resetAllSelectedSeats();
    }
  };

  connectWebSocket(): void {
    // Kết nối tới WebSocket
    this.seatService.connect(this.showtimeId, this.userId);
    
    // Đăng ký lắng nghe dữ liệu ghế
    const seatsSub = this.seatService.getMessages().subscribe((seats: SeatInfo[]) => {
      if (seats && seats.length > 0) {
        console.log('Received updated seats from WebSocket');
        this.seats = seats;
        
        this.organizeSeats();
        
        // Cập nhật danh sách ghế đã chọn dựa trên dữ liệu từ server
        this.selectedSeats = seats.filter(seat => seat.Status === this.SEAT_STATUS.SELECTED);
        
        // Tính lại tổng tiền
        this.calculateTotalPrice();
      }
    });
    
    // Đăng ký lắng nghe cập nhật trạng thái ghế theo sự kiện riêng biệt
    const seatsUpdateSub = this.seatService.seatsUpdated$.subscribe((seats: SeatInfo[]) => {
      if (seats && seats.length > 0) {
        console.log('Seats status updated via WebSocket');
        this.seats = seats;
        this.organizeSeats();
      }
    });
    
    // Đăng ký lắng nghe sự kiện lỗi kết nối
    const connectionErrorSub = this.seatService.connectionFailed$.subscribe(() => {
      alert('Không thể kết nối đến máy chủ đặt vé. Vui lòng thử lại sau!');
      this.router.navigate(['/trangchu/ticket/now']);
    });
    
    this.subscriptions.add(seatsSub);
    this.subscriptions.add(seatsUpdateSub);
    this.subscriptions.add(connectionErrorSub);
  }

  organizeSeats(): void {
    if (!this.seats || this.seats.length === 0) return;
    
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
  }

  getRowName(rowNumber: number): string {
    // Chuyển số hàng thành ký tự (1 -> A, 2 -> B, ...)
    return String.fromCharCode(64 + rowNumber);
  }

  // Lấy tên của ghế đôi đi kèm
  getPairedSeatName(seat: SeatInfo): string {
    if (!seat.PairId) return '';
    const pairedSeat = this.seats.find(s => s.SeatId === seat.PairId);
    return pairedSeat ? pairedSeat.SeatName : '';
  }

  isSeatSelectable(seat: SeatInfo): boolean {
    // Ghế có thể chọn nếu trạng thái là AVAILABLE (0)
    return seat.Status === this.SEAT_STATUS.AVAILABLE;
  }

  getSeatClass(seat: SeatInfo): string {
    let classes = 'seat';
    
    // Áp dụng class dựa trên loại ghế
    if (seat.SeatTypeName.toLowerCase().includes('vip')) {
      classes += ' vip-seat';
    } else if (seat.SeatTypeName.toLowerCase().includes('đôi') || seat.PairId) {
      classes += ' couple-seat';
    }
    
    // Áp dụng class dựa trên trạng thái ghế
    if (seat.Status === this.SEAT_STATUS.BOOKED) {
      classes += ' booked';
    } else if (seat.Status === this.SEAT_STATUS.BUSY) {
      classes += ' reserved';
    } else if (seat.Status === this.SEAT_STATUS.UNAVAILABLE) {
      classes += ' unavailable';
    } else if (seat.Status === this.SEAT_STATUS.SELECTED || this.isSelected(seat)) {
      classes += ' selected';
    }
    
    return classes;
  }

  isSelected(seat: SeatInfo): boolean {
    // Ghế được coi là đã chọn nếu trạng thái là SELECTED hoặc có trong danh sách selectedSeats
    return seat.Status === this.SEAT_STATUS.SELECTED || 
           this.selectedSeats.some(s => s.SeatId === seat.SeatId);
  }

  // Kiểm tra xem việc chọn ghế có hợp lệ không
  validateSeatSelection(seat: SeatInfo): boolean {
    // Nếu đang bỏ chọn ghế, luôn hợp lệ
    if (this.isSelected(seat)) {
      return true;
    }

    // Tìm hàng của ghế đang chọn
    const rowSeats = this.seatingRows.find(row => row.rowNumber === seat.RowNumber)?.seats || [];
    if (rowSeats.length === 0) return true;

    // Lọc ra những ghế có thể chọn được trong hàng đó (trạng thái AVAILABLE hoặc đã được chọn)
    const selectableSeats = rowSeats.filter(s => 
      s.Status === this.SEAT_STATUS.AVAILABLE || this.isSelected(s)
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
            (s.Status === this.SEAT_STATUS.BOOKED || 
             s.Status === this.SEAT_STATUS.BUSY ||
             s.Status === this.SEAT_STATUS.UNAVAILABLE)
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

  toggleSeat(seat: SeatInfo): void {
    if (seat.Status === this.SEAT_STATUS.SELECTED) {
      // Bỏ chọn ghế      
      // Chuẩn bị yêu cầu cập nhật trạng thái ghế
      const updateRequest: SeatStatusUpdateRequest = {
        SeatId: seat.SeatStatusByShowTimeId, // Sử dụng SeatStatusByShowTimeId làm SeatId
        Status: this.SEAT_STATUS.AVAILABLE // Chuyển từ SELECTED (1) về AVAILABLE (0)
      };
      
      // Gửi yêu cầu cập nhật
      this.seatService.updateStatus([updateRequest]);
      
      return;
    }
    
    // Kiểm tra validation trước khi chọn ghế
    if (!this.validateSeatSelection(seat)) {
      return;
    }
    
    // Chọn ghế
    // Chuẩn bị yêu cầu cập nhật trạng thái ghế
    const updateRequest: SeatStatusUpdateRequest = {
      SeatId: seat.SeatStatusByShowTimeId, // Sử dụng SeatStatusByShowTimeId làm SeatId
      Status: this.SEAT_STATUS.SELECTED // Chuyển từ AVAILABLE (0) sang SELECTED (1)
    };
    
    // Gửi yêu cầu cập nhật
    this.seatService.updateStatus([updateRequest]);
    
    // Xử lý ghế đôi
    if (seat.PairId) {
      const pairedSeat = this.seats.find(s => s.SeatId === seat.PairId);
      if (pairedSeat && pairedSeat.Status === this.SEAT_STATUS.AVAILABLE) {
        // Chuẩn bị yêu cầu cập nhật trạng thái ghế đôi
        const pairUpdateRequest: SeatStatusUpdateRequest = {
          SeatId: pairedSeat.SeatStatusByShowTimeId, // Sử dụng SeatStatusByShowTimeId làm SeatId
          Status: this.SEAT_STATUS.SELECTED
        };
        
        // Gửi yêu cầu cập nhật cho ghế đôi
        this.seatService.updateStatus([pairUpdateRequest]);
      }
    }
  }

  calculateTotalPrice(): void {
    this.totalPrice = this.selectedSeats.reduce((total, seat) => total + seat.SeatPrice, 0);
  }

  continueToFoodSelection(): void {
    // Validate chọn ghế trước khi tiếp tục
    if (this.selectedSeats.length === 0) {
      this.validationMessage = 'Vui lòng chọn ít nhất một ghế để tiếp tục.';
      return;
    }
    
    // Reset validation message nếu có
    this.validationMessage = '';
    
    // Lưu danh sách ghế đã chọn vào localStorage
    localStorage.setItem('selectedSeats', JSON.stringify(this.selectedSeats));
    
    // Lưu showTimeId vào localStorage để sử dụng sau này
    localStorage.setItem('currentShowTimeId', this.showtimeId);
    
    // Đảm bảo không cập nhật UI khi chuyển hướng
    const currentStatuses = this.selectedSeats.map(seat => ({ 
      SeatId: seat.SeatStatusByShowTimeId, 
      Status: this.SEAT_STATUS.SELECTED 
    }));
    
    // Chuyển hướng tới trang chọn thức ăn
    this.router.navigate(['/trangchu/ticket/food', this.showtimeId]);
  }

  goBack(): void {
    // Bỏ chọn tất cả các ghế đã chọn trước khi quay lại
    this.resetAllSelectedSeats();
    
    // Đợi một chút để đảm bảo cập nhật được gửi đi trước khi chuyển trang
    setTimeout(() => {
      this.router.navigate(['/trangchu/ticket/now']);
    }, 300);
  }

  // Kiểm tra xem ghế có nên hiển thị hay không (đối với ghế đôi)
  shouldDisplaySeat(seat: SeatInfo): boolean {
    // Nếu không phải ghế đôi thì luôn hiển thị
    if (!seat.PairId) return true;
    
    // Với ghế đôi, chỉ hiển thị một trong hai ghế
    // Chúng ta sẽ hiển thị ghế có SeatId nhỏ hơn (thường là ghế đầu tiên trong cặp)
    // hoặc ghế có vị trí bên trái (ColNumber nhỏ hơn)
    const pairedSeat = this.seats.find(s => s.SeatId === seat.PairId);
    if (!pairedSeat) return true;
    
    // Nếu cùng hàng, chọn ghế có số cột nhỏ hơn
    if (seat.RowNumber === pairedSeat.RowNumber) {
      return seat.ColNumber < pairedSeat.ColNumber;
    }
    
    // Nếu khác hàng, chọn ghế có số hàng nhỏ hơn
    return seat.RowNumber < pairedSeat.RowNumber;
  }

  // Xây dựng tên ghế đôi (kết hợp cả hai ghế)
  getCoupleSeatName(seat: SeatInfo): string {
    if (!seat.PairId) return seat.SeatName;
    
    const pairedSeat = this.seats.find(s => s.SeatId === seat.PairId);
    if (!pairedSeat) return seat.SeatName;
    
    return `${seat.SeatName}-${pairedSeat.SeatName}`;
  }

  // Hàm bỏ chọn tất cả các ghế đã chọn
  resetAllSelectedSeats(): void {
    const selectedSeatsToReset = this.selectedSeats.map(seat => ({
      SeatId: seat.SeatStatusByShowTimeId,
      Status: this.SEAT_STATUS.AVAILABLE
    }));
    
    if (selectedSeatsToReset.length > 0) {
      // Gửi yêu cầu cập nhật trạng thái các ghế về AVAILABLE
      this.seatService.updateStatus(selectedSeatsToReset);
      // Xóa dữ liệu ghế đã chọn trong localStorage
      localStorage.removeItem('selectedSeats');
    }
  }
}