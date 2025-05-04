import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { WebsocketService, SeatStatus } from '../../../services/websocket.service';
import { SeatInfo } from '../../../models/SeatModel';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

// Interface để cập nhật trạng thái ghế
interface SeatStatusUpdateRequest {
  SeatId: string;
  Status: number;
}

interface SeatingRow {
  rowName: string;
  rowNumber: number;
  seats: SeatInfo[];
}

@Component({
  selector: 'app-seat-map',
  templateUrl: './seat-map.component.html',
  styleUrls: ['./seat-map.component.css'],
  imports: [CommonModule, DecimalPipe],
  standalone: true
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
  private userId: string = ''; // ID của người dùng hiện tại
  private connectionTimeouts: any[] = []; // Lưu các timeout ID để hủy khi cần
  private lastSuccessfulSeatLoad: Date | null = null; // Lưu thời điểm tải ghế thành công gần nhất
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
    // Khởi tạo biến để theo dõi số lần thử lại
    let retryCount = 0;
    const maxRetries = 3;

    // Hàm để thử lại kết nối và lấy dữ liệu ghế
    const connectAndRetryIfNeeded = () => {
      console.log(`Thử kết nối WebSocket lần ${retryCount + 1}/${maxRetries + 1}`);
      
      // Kết nối tới WebSocket
      this.seatService.connect(this.showtimeId, this.userId);
      
      // Thiết lập timeout để kiểm tra nếu không nhận được dữ liệu ghế
      const timeoutId = setTimeout(() => {
        // Nếu chưa có ghế và vẫn còn cơ hội thử lại
        if (this.seats.length === 0 && retryCount < maxRetries) {
          console.warn(`Không nhận được dữ liệu ghế sau 5 giây, thử lại...`);
          retryCount++;
          this.seatService.disconnect(); // Đóng kết nối hiện tại
          setTimeout(connectAndRetryIfNeeded, 1000); // Thử lại sau 1 giây
        } else if (this.seats.length === 0 && retryCount >= maxRetries) {
          console.error(`Đã thử lại ${maxRetries} lần nhưng không nhận được dữ liệu ghế.`);
          // Thông báo cho người dùng về vấn đề kết nối
          this.validationMessage = "Không thể tải danh sách ghế. Vui lòng tải lại trang hoặc chọn xuất chiếu khác.";
        }
      }, 5000);
      
      // Lưu timeout ID để có thể hủy nếu cần
      this.connectionTimeouts.push(timeoutId);
    };
    
    // Bắt đầu kết nối
    connectAndRetryIfNeeded();
    
    // Đăng ký lắng nghe dữ liệu ghế
    const seatsSub = this.seatService.getMessages().subscribe((seats: SeatInfo[]) => {
      // Hủy tất cả các timeout kiểm tra vì đã nhận được dữ liệu
      this.connectionTimeouts.forEach(id => clearTimeout(id));
      this.connectionTimeouts = [];
      
      if (seats && seats.length > 0) {
        console.log(`Nhận ${seats.length} ghế từ WebSocket`);
        this.seats = seats;
        this.lastSuccessfulSeatLoad = new Date();
        
        // Xóa thông báo lỗi nếu có
        this.validationMessage = "";
        
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

  /**
   * Kiểm tra xem việc chọn ghế có hợp lệ không dựa trên các quy tắc đặt ghế
   * @param seat Ghế được chọn hoặc bỏ chọn
   * @param action Hành động 'select' (chọn ghế) hoặc 'unselect' (bỏ chọn ghế)
   * @returns true nếu việc chọn/bỏ chọn hợp lệ, ngược lại false
   */
  validateSeatSelection(seat: SeatInfo, action: 'select' | 'unselect' = 'select'): boolean {
    console.log(`Validating ${action} for seat ${seat.SeatName}`);
    
    // Tìm hàng của ghế
    const rowSeats = this.seatingRows.find(row => row.rowNumber === seat.RowNumber)?.seats || [];
    if (rowSeats.length === 0) return true;
    
    // Nếu đang CHỌN ghế mới
    if (action === 'select') {
      // Lọc ra những ghế đã được chọn trong hàng (không bao gồm ghế đang chọn)
      const selectedInRow = rowSeats.filter(s => this.isSelected(s));
      
      // Sắp xếp ghế đã chọn theo số cột
      const sortedSelected = [...selectedInRow].sort((a, b) => a.ColNumber - b.ColNumber);
      
      // Sắp xếp tất cả ghế trong hàng theo số cột
      const sortedRowSeats = [...rowSeats].sort((a, b) => a.ColNumber - b.ColNumber);
      
      // KIỂM TRA XEM VIỆC CHỌN GHẾ NÀY CÓ TẠO THÀNH HAI GHẾ LIỀN KỀ KHÔNG
      // Tìm các ghế liền kề với ghế đang chọn mà đã được chọn
      const adjacentSelectedSeats = selectedInRow.filter(s => 
        Math.abs(s.ColNumber - seat.ColNumber) === 1
      );
      
      if (adjacentSelectedSeats.length > 0) {
        console.log(`Ghế ${seat.SeatName} liền kề với ${adjacentSelectedSeats.length} ghế đã chọn`);
        
        // Với mỗi ghế đã chọn liền kề, kiểm tra xem nó có tạo thành cặp ghế liên tiếp không
        for (const adjacentSeat of adjacentSelectedSeats) {
          // Xác định ghế ngoài cùng ở phía bên kia của cặp ghế liền kề
          const outerColNumber = seat.ColNumber + (seat.ColNumber - adjacentSeat.ColNumber);
          
          // Tìm ghế ngoài cùng trong hàng nếu nó tồn tại
          const outerSeat = rowSeats.find(s => s.ColNumber === outerColNumber);
          
          // Nếu ghế ngoài cùng tồn tại và có thể chọn được (AVAILABLE) nhưng chưa được chọn
          if (outerSeat && 
              outerSeat.Status === this.SEAT_STATUS.AVAILABLE && 
              !this.isSelected(outerSeat)) {
            console.log(`Tìm thấy ghế ngoài cùng ${outerSeat.SeatName} chưa được chọn`);
            
            // Kiểm tra xem còn ghế nào khác chưa được chọn trong hàng không
            const otherAvailableSeats = rowSeats.filter(s => 
              s.Status === this.SEAT_STATUS.AVAILABLE && 
              !this.isSelected(s) && 
              s.SeatId !== seat.SeatId && 
              s.SeatId !== outerSeat.SeatId
            );
            
            // Nếu không còn ghế nào khác có thể chọn, thì có thể chọn ghế này
            if (otherAvailableSeats.length === 0) {
              this.validationMessage = '';
              return true;
            }
            
            // Nếu còn ghế khác có thể chọn, bắt buộc phải chọn ghế ngoài cùng
            this.validationMessage = 'Bạn không thể để trống ghế ngoài cùng khi chọn hai ghế liên tiếp. Vui lòng chọn ghế ngoài cùng trước!';
            return false;
          }
        }
      }
      
      // Quy tắc 1: Không được bỏ trống ghế ở giữa
      // Sắp xếp ghế theo cột bao gồm ghế đang chọn
      const sortedSelectedWithCurrent = [...selectedInRow, seat].sort((a, b) => a.ColNumber - b.ColNumber);
      
      // Kiểm tra xem có bỏ trống ghế ở giữa không
      for (let i = 0; i < sortedSelectedWithCurrent.length - 1; i++) {
        const currentSeat = sortedSelectedWithCurrent[i];
        const nextSeat = sortedSelectedWithCurrent[i + 1];
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
      
      // Quy tắc 2: Đối với đặt vé trước, phải chọn từ mép ngoài cùng
      if (this.isPreorder && selectedInRow.length === 0) {
        // Lọc ra những ghế có thể chọn được trong hàng đó (trạng thái AVAILABLE)
        const selectableSeats = rowSeats.filter(s => 
          s.Status === this.SEAT_STATUS.AVAILABLE
        );
        
        // Sắp xếp ghế có thể chọn theo cột
        const sortedSelectable = [...selectableSeats].sort((a, b) => a.ColNumber - b.ColNumber);
        
        if (sortedSelectable.length > 0) {
          // Kiểm tra xem ghế đang chọn có phải là ghế ngoài cùng bên trái hoặc phải không
          const isLeftmostSeat = seat.ColNumber === sortedSelectable[0].ColNumber;
          const isRightmostSeat = seat.ColNumber === sortedSelectable[sortedSelectable.length - 1].ColNumber;
          
          if (!isLeftmostSeat && !isRightmostSeat) {
            this.validationMessage = 'Khi đặt vé trước, bạn phải chọn ghế từ mép ngoài cùng!';
            return false;
          }
        }
      }
      
      this.validationMessage = '';
      return true;
    } 
    // Nếu đang BỎ CHỌN ghế
    else if (action === 'unselect') {
      console.log('Validating unselect action for seat:', seat.SeatName);
      
      // Lọc ra tất cả các ghế đã chọn trong hàng (bao gồm cả ghế đang xem xét)
      const selectedInRow = rowSeats.filter(s => 
        s.Status === this.SEAT_STATUS.SELECTED || s.SeatId === seat.SeatId
      );
      
      console.log('Selected seats in row:', selectedInRow.map(s => s.SeatName).join(', '));
      
      // Nếu có ít nhất 3 ghế được chọn trong hàng (bao gồm ghế đang muốn bỏ chọn)
      if (selectedInRow.length >= 3) {
        // Sắp xếp ghế theo cột
        const sortedSelected = [...selectedInRow].sort((a, b) => a.ColNumber - b.ColNumber);
        
        // Tìm các cặp ghế liên tiếp
        const consecutivePairs = [];
        for (let i = 0; i < sortedSelected.length - 1; i++) {
          if (sortedSelected[i+1].ColNumber - sortedSelected[i].ColNumber === 1) {
            consecutivePairs.push({
              start: sortedSelected[i],
              end: sortedSelected[i+1]
            });
          }
        }
        
        // Nếu có cặp ghế liên tiếp
        if (consecutivePairs.length > 0) {
          const isLeftmostSeat = seat.ColNumber === sortedSelected[0].ColNumber;
          const isRightmostSeat = seat.ColNumber === sortedSelected[sortedSelected.length - 1].ColNumber;
          
          console.log('Checking if seat is outer:', seat.SeatName);
          console.log('isLeftmost:', isLeftmostSeat, 'isRightmost:', isRightmostSeat);
          
          // Nếu là ghế ngoài cùng, kiểm tra xem việc bỏ chọn có tạo ra một cặp ghế liên tiếp với ghế ngoài cùng bị bỏ trống không
          if (isLeftmostSeat || isRightmostSeat) {
            // Tìm cặp ghế liên tiếp nằm sát với ghế ngoài cùng đang muốn bỏ chọn
            const adjacentPair = consecutivePairs.find(pair => 
              (pair.start.ColNumber === seat.ColNumber + 1) || 
              (pair.end.ColNumber === seat.ColNumber - 1)
            );
            
            if (adjacentPair) {
              this.validationMessage = 'Khi đã chọn hai ghế cạnh nhau, không thể bỏ ghế ngoài cùng!';
              console.log('Validation failed: Cannot unselect outer seat when consecutive seats are selected');
              return false;
            }
          }
        }
      }
      
      this.validationMessage = '';
      return true;
    }
    
    return true;
  }
  
  /**
   * Tìm ghế ở vị trí cột cụ thể trong một hàng
   * @param rowSeats Danh sách ghế trong hàng
   * @param colNumber Số cột cần tìm
   * @returns Ghế tại vị trí cột đó hoặc undefined nếu không tìm thấy
   */
  private findAvailableSeatAtPosition(rowSeats: SeatInfo[], colNumber: number): SeatInfo | undefined {
    return rowSeats.find(s => s.ColNumber === colNumber);
  }

  toggleSeat(seat: SeatInfo): void {
    if (seat.Status === this.SEAT_STATUS.SELECTED) {
      // Bỏ chọn ghế - không cần kiểm tra validation khi bỏ chọn nữa
      // Chuẩn bị yêu cầu cập nhật trạng thái ghế
      const updateRequest: SeatStatusUpdateRequest = {
        SeatId: seat.SeatStatusByShowTimeId, // Sử dụng SeatStatusByShowTimeId làm SeatId
        Status: this.SEAT_STATUS.AVAILABLE // Chuyển từ SELECTED (1) về AVAILABLE (0)
      };
      
      // Gửi yêu cầu cập nhật
      this.seatService.updateStatus([updateRequest]);
      
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
    
    // Kiểm tra ghế lẻ trong mỗi hàng
    if (!this.validateAllRows()) {
      // Thông báo lỗi đã được gán vào validationMessage
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
      this.router.navigate(['/trangchu']);
    }, 100);
  }

  /**
   * Kiểm tra tất cả ghế trong một hàng để đảm bảo không có ghế lẻ
   * @param seats Danh sách ghế cần kiểm tra
   * @returns true nếu tất cả ghế đều hợp lệ, false nếu có ghế lẻ
   */
  validateRowSeats(seats: SeatInfo[]): boolean {
    // Nếu không có ghế nào đang chọn thì ok luôn
    const hasSelected = seats.some(s => s.Status === this.SEAT_STATUS.SELECTED);
    if (!hasSelected) return true;

    // Đếm số ghế đã chọn trong hàng
    const selectedSeatsInRow = seats.filter(s => s.Status === this.SEAT_STATUS.SELECTED);
    
    // Nếu chỉ có 1 ghế được chọn, miễn quy tắc ghế lẻ
    if (selectedSeatsInRow.length === 1) {
      return true;
    }

    // occupancy: 1 = Selected/Booked, 0 = Available
    const occupancy = seats.map(s =>
      (s.Status === this.SEAT_STATUS.SELECTED || s.Status === this.SEAT_STATUS.BOOKED) ? 1 : 0
    );

    const total = seats.length;

    for (let i = 0; i < total; i++) {
      // chỉ quan tâm ghế trống
      if (occupancy[i] === 0) {
        // kiểm tra bên trái
        const leftIsEdge = i === 0;
        const leftOccupied = leftIsEdge
          // nếu là lối đi, bạn có thể cho phép (thì đổi true thành false)
          ? true
          : occupancy[i - 1] === 1;

        // kiểm tra bên phải
        const rightIsEdge = i === total - 1;
        const rightOccupied = rightIsEdge
          // nếu là lối đi, bạn có thể cho phép (thì đổi true thành false)
          ? true
          : occupancy[i + 1] === 1;

        // nếu hai bên đều occupied → có nguy cơ ghế lẻ
        if (leftOccupied && rightOccupied) {
          // ngoại lệ 1: ghế này có ghế "đối ứng" (paired seat) cũng đang Selected → cho phép
          const seat = seats[i];
          const paired = this.findPairedSeat(seat);
          const pairedIsSelected = paired?.Status === this.SEAT_STATUS.SELECTED;

          if (!pairedIsSelected) {
            const rowLabel = this.getRowName(seat.RowNumber);
            const col = seat.ColNumber;
            this.validationMessage = `Không thể để lẻ ghế ở hàng ${rowLabel} số ${col}`;
            return false;
          }
        }
      }
    }

    return true;
  }
  
  /**
   * Tìm ghế đối ứng trong cặp ghế đôi
   * @param seat Ghế cần tìm ghế đối ứng
   * @returns Ghế đối ứng hoặc undefined nếu không tìm thấy
   */
  findPairedSeat(seat: SeatInfo): SeatInfo | undefined {
    if (!seat.PairId) return undefined;
    return this.seats.find(s => s.SeatId === seat.PairId);
  }
  
  /**
   * Kiểm tra tất cả các hàng ghế để tìm ghế lẻ
   * @returns true nếu tất cả hàng đều hợp lệ, false nếu phát hiện ghế lẻ
   */
  validateAllRows(): boolean {
    for (const row of this.seatingRows) {
      if (!this.validateRowSeats(row.seats)) {
        // Thông báo lỗi đã được gán vào validationMessage trong validateRowSeats
        return false;
      }
    }
    return true;
  }
  
  /**
   * Đóng thông báo lỗi validation
   */
  closeValidationMessage(): void {
    this.validationMessage = '';
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
