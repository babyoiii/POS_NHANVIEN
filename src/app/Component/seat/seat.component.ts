// import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, Renderer2, ElementRef, ViewChild } from '@angular/core';
// import { CommonModule, Location } from '@angular/common';
// import { DurationFormatPipe } from '../../duration-format.pipe'; 
// import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// import { SeatService } from '../../services/seat.service'; 
// import { Subject } from 'rxjs';
// import { takeUntil, catchError, finalize } from 'rxjs/operators';
// import { SeatInfo } from '../../models/SeatModel'; 
// import { GroupByPipe } from '../../GroupByPipe.pipe'; 
// import { ToastrService } from 'ngx-toastr';
// import { MatDialog } from '@angular/material/dialog';
// import { DialogData, NotificationDialogComponent } from '../notification-dialog/notification-dialog.component';
// import { SeatDataService } from '../../Service/SeatData.service';
// import { ModalService } from '../../Service/modal.service';
// import { ShowtimeService } from '../../Service/showtime.service';
// import { MovieByShowtimeData } from '../../Models/MovieModel';
// import { AuthServiceService } from '../../Service/auth-service.service';
// import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

// enum SeatStatus {
//   Available = 0,
//   Selected = 1,
//   Booked = 5,
//   Unavailable = 3,
//   Busy = 4
// }

// interface SeatStatusUpdateRequest {
//   SeatId: string;
//   Status: SeatStatus;
// }

// @Component({
//   selector: 'app-seats',
//   standalone: true,
//   imports: [CommonModule, DurationFormatPipe, GroupByPipe, RouterLink],
//   templateUrl: './seats.component.html',
//   styleUrls: ['./seats.component.css'],
//   changeDetection: ChangeDetectionStrategy.OnPush
// })
// export class SeatsComponent implements OnInit, OnDestroy {
//   private readonly destroy$ = new Subject<void>();

//   seats: SeatInfo[] = [];
//   seatsCore: SeatInfo[] = [];
//   selectedSeats: SeatInfo[] = [];
//   totalAmount = 0;
//   isLoading = true;
//   error: string | null = null;
//   Rows: string[] = [];
//   seatsPerRow: Record<string, SeatInfo[]> = {};
//   countdown: string | null = null;
//   isPanelCollapsed = false;

//   movieInfo: any = null;

//   @ViewChild('seatMapContainer') seatMapContainer!: ElementRef;

//   currentZoom: number = 1;
//   minZoom: number = 0.6;
//   maxZoom: number = 2.0;
//   zoomStep: number = 0.1;
//   isDragging: boolean = false;
//   startX: number = 0;
//   startY: number = 0;
//   translateX: number = 0;
//   translateY: number = 0;
//   private eventListeners: (() => void)[] = [];







//   movieDetail: MovieByShowtimeData | null = null;
//   constructor(
//     private seatService: SeatService,
//     private seatDataService: SeatDataService,
//     private route: ActivatedRoute,
//     private router: Router,
//     private cdr: ChangeDetectorRef,
//     private toastr: ToastrService,
//     private dialog: MatDialog,
//     private location: Location,
//     private modalService: ModalService,
//     private showtimeService : ShowtimeService,
//     private authServiceService: AuthServiceService
//   ) { }

 
//   ngOnInit(): void {
//     this.route.params
//       .pipe(takeUntil(this.destroy$))
//       .subscribe(params => {
//         const showtimeId = params['id'];
//         this.loadSeatsByShowtimeId(showtimeId)
//         localStorage.setItem('currentShowtimeId', showtimeId);
//         const userId = this.ensureUserId();
//         console.log(userId);

//         if (showtimeId) {
//           const navigation = this.router.getCurrentNavigation();
//           if (navigation?.extras.state) {
//             const state = navigation.extras.state as { seats: SeatInfo[], selectedSeats: SeatInfo[], totalAmount: number };
//             this.seats = state.seats;
//             this.selectedSeats = state.selectedSeats;
//             this.totalAmount = state.totalAmount;
//             this.isLoading = false;
//             this.cdr.markForCheck();
//           } else {
//             this.loadSeats(showtimeId, userId);
//           }
//         }
//       });

//     const shouldReload = sessionStorage.getItem('reloadOnce');
//     if (shouldReload) {
//       sessionStorage.removeItem('reloadOnce');
//       this.reloadCurrentRoute();
//     }

//     this.seatDataService.seats$.pipe(takeUntil(this.destroy$)).subscribe(seats => {
//       this.seats = seats;
//       this.cdr.markForCheck();
//     });

//     this.seatDataService.selectedSeats$.pipe(takeUntil(this.destroy$)).subscribe(selectedSeats => {
//       this.selectedSeats = selectedSeats;
//       this.cdr.markForCheck();
//     });
//     this.seatDataService.seatCore$.pipe(takeUntil(this.destroy$)).subscribe(seatCore => {
//       this.seatsCore = seatCore;
//       this.cdr.markForCheck();
//     });

//     this.seatDataService.totalAmount$.pipe(takeUntil(this.destroy$)).subscribe(totalAmount => {
//       this.totalAmount = totalAmount;
//       this.cdr.markForCheck();
//     });






//     const movieInfoStr = localStorage.getItem('currentMovieInfo');
//     if (movieInfoStr) {
//       this.movieInfo = JSON.parse(movieInfoStr);
//     }

//     console.log("Dữ liệu nghĩa", movieInfoStr)

//   }

//   private reloadCurrentRoute(): void {
//     const currentUrl = this.router.url;
//     this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
//       this.router.navigate([currentUrl]);
//     });
//   }
//   openSignIn() {
//     this.modalService.openSignInModal();
//   }
//   private loadSeats(showtimeId: string, userId: string): void {
//     this.seats = [];
//     this.selectedSeats = [];
//     this.totalAmount = 0;
//     this.isLoading = true;
//     this.error = null;
//     this.cdr.markForCheck();

//     const selectedSeatsStr = localStorage.getItem('selectedSeats');
//     const selectedSeats = selectedSeatsStr ? JSON.parse(selectedSeatsStr) : [];

//     this.initializeWebSocket(showtimeId, userId);

//     this.selectedSeats = selectedSeats;
//   }

//   private initializeWebSocket(showtimeId: string, userId: string): void {
//     this.seatService.connect(showtimeId, userId);

//     this.seatService.getMessages()
//       .pipe(
//         takeUntil(this.destroy$),
//         catchError(error => {
//           this.handleSeatError(error);
//           throw error;
//         }),
//         finalize(() => {
//           this.isLoading = false;
//           this.cdr.markForCheck();
//         })
//       )
//       .subscribe({
//         next: (data: SeatInfo[]) => {
//           this.processSeatData(data);
//           this.calculateTotal();
//         }
//       });

//     this.seatService.getJoinRoomMessages()
//       .pipe()
//       .subscribe({
//         next: (count: number | null) => {
//           if (count !== null && count > 0) {
//             this.handleCountdown(count);
//           }
//         },
//         error: (error) => this.handleCountdownError(error)
//       });
//   }
//    checkLogin(): boolean {
//    return this.authServiceService.isLoggedIn();
//    }
//   private processSeatData(data: SeatInfo[]): void {

//     this.seatsCore = [...data].flat();
//     this.seatDataService.setSeatCore(this.seatsCore);
//     this.seats = this.filterAndSortSeats(this.seatsCore);
//     this.selectedSeats = this.seats.filter(seat => seat.Status === SeatStatus.Selected);
//     this.groupSeatsByRow();
//     this.calculateTotal();
//     this.cdr.markForCheck();

//     // Save seat data to the service
//     this.seatDataService.setSeats(this.seats);
//     this.seatDataService.setSelectedSeats(this.selectedSeats);
//     this.seatDataService.setTotalAmount(this.totalAmount);
//   }
//   loadSeatsByShowtimeId(showtimeId: string): void {
//     this.showtimeService.getMovieByShowtime(showtimeId).subscribe({
//       next: (response) => {
//         if (response && response.data) {
//           this.movieDetail = response.data; 
//           console.log('✅ Movie Detail:', this.movieDetail);
//           this.cdr.markForCheck(); 
//         }
//       },
//       error: (err) => {
//         console.error('❌ Error loading movie detail:', err);
//       }
//     });
//   }
//   private groupSeatsByRow(): void {
//     this.seatsPerRow = this.seats.reduce((acc, seat) => {
//       const rowKey = seat.RowNumber.toString();
//       if (!acc[rowKey]) {
//         acc[rowKey] = [];
//         this.Rows.push(rowKey);
//       }
//       acc[rowKey].push(seat);
//       return acc;
//     }, {} as Record<string, SeatInfo[]>);

//     this.Rows.sort((a, b) => parseInt(a) - parseInt(b));
//   }

//   private handleSeatError(error: any): void {
//     console.error('Error receiving seats:', error);
//     this.error = 'Error loading seat data';
//     this.isLoading = false;
//     this.cdr.markForCheck();
//   }

//   private handleCountdown(count: number): void {
//     const minutes = Math.floor(count / 60);
//     const seconds = count % 60;
//     this.countdown = `${minutes}:${seconds.toString().padStart(2, '0')}`;
//     this.cdr.markForCheck();
//     if (count === 0) {
//       this.notifyAndRedirect();
//     }
//   }

//   private handleCountdownError(error: any): void {
//     console.error('Lỗi khi nhận countdown:', error);
//   }

//   private ensureUserId(): string {
//     let userId = localStorage.getItem('userId');

//     if (!userId) {
//       userId = this.generateUserId();
//       localStorage.setItem('userId', userId);
//     }
//     return userId;
//   }

//   private generateUserId(): string {
//     return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
//       const r = Math.random() * 16 | 0;
//       const v = c === 'x' ? r : (r & 0x3 | 0x8);
//       return v.toString(16);
//     });
//   }

//   ngOnDestroy(): void {
//     this.destroy$.next();
//     this.destroy$.complete();

//     // Dọn dẹp tất cả event listeners
//     this.eventListeners.forEach(cleanupFn => cleanupFn());
//     this.eventListeners = [];
//   }

//   toggleSeatStatus(seat: SeatInfo): void {
//     if (seat.Status !== SeatStatus.Available && seat.Status !== SeatStatus.Selected) {
//       return;
//     }

//     const updateRequests: SeatStatusUpdateRequest[] = [];
//     const newStatus = seat.Status === SeatStatus.Available
//       ? SeatStatus.Selected
//       : SeatStatus.Available;

//     if (newStatus === SeatStatus.Selected) {
//       const pairedSeat = this.findPairedSeat(seat);

//       const totalSelectedSeats = this.selectedSeats.reduce((count, s) => {
//         return count + (s.PairId ? 2 : 1);
//       }, 0);

//       const seatsToAdd = pairedSeat ? 2 : 1;
//       if (totalSelectedSeats + seatsToAdd > 8) {
//         this.toastr.warning('Bạn chỉ được chọn tối đa 8 ghế!', 'Cảnh báo');
//         return;
//       }
//     }

//     const seatsToUpdate = [seat];
//     const pairedSeat = this.findPairedSeat(seat);
//     if (pairedSeat) {
//       seatsToUpdate.push(pairedSeat);
//     }

//     seatsToUpdate.forEach(s => {
//       s.Status = newStatus;
//       updateRequests.push({
//         SeatId: s.SeatStatusByShowTimeId,
//         Status: newStatus
//       });
//     });

//     this.selectedSeats = this.seats.filter(s => s.Status === SeatStatus.Selected);
//     this.calculateTotal();

//     if (updateRequests.length > 0) {
//       this.seatService.updateStatus(updateRequests);
//     }

//     this.cdr.markForCheck();
//   }

//   calculateTotal(): void {
//     this.totalAmount = this.selectedSeats.reduce((sum, seat) => {
//       const pairedSeat = this.findPairedSeat(seat);
//       if (pairedSeat && seat.PairId) {
//         return sum + seat.SeatPrice + pairedSeat.SeatPrice;
//       }
//       return sum + seat.SeatPrice;
//     }, 0);
//   }

//   formatPrice(price: number): string {
//     return new Intl.NumberFormat('vi-VN', {
//       style: 'currency',
//       currency: 'VND'
//     }).format(price);
//   }

//   findPairedSeat(seat: SeatInfo): SeatInfo | null {
//     if (!seat.PairId) return null;
//     return this.seatsCore.find(s => s.SeatId === seat.PairId) || null;
//   }

//   getSeatFillClass(seat: SeatInfo): string {
//     switch (seat.Status) {
//       case SeatStatus.Available:
//         return '';
//       case SeatStatus.Selected:
//         return 'fill-red-500';
//       case SeatStatus.Booked:
//         return 'fill-gray-500';
//       case SeatStatus.Busy:
//         return 'fill-gray-200';
//       case SeatStatus.Unavailable:
//         return 'cursor-not-allowed invisible';
//       default:
//         console.warn(`Unexpected seat status: ${seat.Status}`);
//         return '';
//     }
//   }
//   private notifyAndRedirect(): void {
//     this.toastr.warning('Thời gian giữ ghế đã hết, bạn sẽ được chuyển hướng.', 'Cảnh báo');
//     setTimeout(() => {
//       this.router.navigate(['/']);
//     }, 3000);
//   }
//   getSeatNameByPairId(pairId: string): string | undefined {
//     var result = this.seatsCore.find(seat => seat.SeatId === pairId)?.SeatName;
//     return result;
//   }

//   getRowLabel(rowNumber: number): string {
//     return String.fromCharCode(64 + rowNumber);
//   }

//   private filterAndSortSeats(seats: SeatInfo[]): SeatInfo[] {
//     const displayedSeats = new Set<string>();

//     const sortedSeats = seats.sort((a, b) => {
//       if (a.RowNumber === b.RowNumber) {
//         return a.ColNumber - b.ColNumber;
//       }
//       return a.RowNumber - b.RowNumber;
//     });

//     return sortedSeats.filter(seat => {
//       if (!seat.PairId) {
//         return true;
//       }

//       const seatPairKey = [seat.SeatId, seat.PairId].sort().join('-');
//       if (displayedSeats.has(seatPairKey)) {
//         return false;
//       }

//       displayedSeats.add(seatPairKey);
//       return true;
//     });
//   }

//   validateRowSeats(seats: SeatInfo[]): boolean {
//     const hasSelected = seats.some(seat => seat.Status === SeatStatus.Selected);
//     if (!hasSelected) return true;

//     const occupancy = seats.map(seat =>
//       (seat.Status === SeatStatus.Selected || seat.Status === SeatStatus.Booked) ? 1 : 0
//     );

//     for (let i = 0; i < seats.length; i++) {
//       if (occupancy[i] === 0) {
//         const leftOccupied = (i === 0) ? true : (occupancy[i - 1] === 1);
//         const rightOccupied = (i === seats.length - 1) ? true : (occupancy[i + 1] === 1);

//         const seat = seats[i];
//         const pairedSeat = this.findPairedSeat(seat);
//         const isPairedSeatSelected = pairedSeat && pairedSeat.Status === SeatStatus.Selected;

//         if (leftOccupied && rightOccupied && !isPairedSeatSelected) {
//           this.toastr.error(`Không thể bỏ trống ghế lẻ ở hàng ${this.getRowLabel(seats[i].RowNumber)} số ${seats[i].ColNumber}`, 'Lỗi');
//           return false;
//         }
//       }
//     }
//     return true;
//   }

//   showNotification(type: 'success' | 'error' | 'warning', message: string): void {
//     const dialogData: DialogData = { type, message };
//     this.dialog.open(NotificationDialogComponent, {
//       data: dialogData
//     });
//   }

//   validateSeats(): boolean {
//     if (this.selectedSeats.length === 0) {
//       this.showNotification('warning', 'Vui lòng chọn ít nhất một ghế!');
//       return false;
//     }

//     for (const row of this.Rows) {
//       const rowSeats = this.seatsPerRow[row];
//       if (!this.validateRowSeats(rowSeats)) {
//         return false;
//       }
//     }

//     return true;
//   }

//   onContinue(): void {
//     if (this.validateSeats()) {
//       const selectedSeatsInfo = this.selectedSeats.flatMap(seat => {
//         const pairedSeat = this.findPairedSeat(seat);

//         if (!seat.SeatStatusByShowTimeId) {
//           return [];
//         }

//         if (pairedSeat && seat.PairId) {
//           const isPairedAlreadyAdded = this.selectedSeats.some(
//             (s) => s.SeatId === pairedSeat.SeatId
//           );

//           if (!isPairedAlreadyAdded && pairedSeat.SeatStatusByShowTimeId) {
//             return [
//               {
//                 seatId: seat.SeatStatusByShowTimeId,
//                 seatName: seat.SeatName,
//                 price: seat.SeatPrice,
//                 SeatTypeName: seat.SeatTypeName
//               },
//               {
//                 seatId: pairedSeat.SeatStatusByShowTimeId,
//                 seatName: pairedSeat.SeatName,
//                 price: pairedSeat.SeatPrice,
//                 SeatTypeName: pairedSeat.SeatTypeName
//               }
//             ];
//           }
//         }

//         return {
//           seatId: seat.SeatStatusByShowTimeId,
//           seatName: seat.SeatName,
//           price: seat.SeatPrice,
//           SeatTypeName: seat.SeatTypeName
//         };
//       });

//       localStorage.setItem('selectedSeats', JSON.stringify(selectedSeatsInfo));
//       this.router.navigate(['/orders'], { state: { seats: this.seats, selectedSeats: this.selectedSeats, totalAmount: this.totalAmount } });
//     }
//   }














































//   toggleInfoPanel() {
//     this.isPanelCollapsed = !this.isPanelCollapsed;
//   }






//   // Thay thế các phương thức từ dòng 546 đến dòng 615 với mã tối ưu hơn
//   // Zoom in
//   zoomIn(): void {
//     if (this.currentZoom < this.maxZoom) {
//       this.currentZoom += this.zoomStep;
//       this.applyTransform();
//     }
//   }

//   // Zoom out
//   zoomOut(): void {
//     if (this.currentZoom > this.minZoom) {
//       this.currentZoom -= this.zoomStep;
//       this.applyTransform();

//       // Reset vị trí nếu zoom quá nhỏ
//       if (this.currentZoom <= 1) {
//         this.resetPosition();
//       }
//     }
//   }

//   // Reset vị trí về trung tâm
//   resetPosition(): void {
//     this.translateX = 0;
//     this.translateY = 0;
//     this.applyTransform();
//   }

//   // Áp dụng phép biến đổi cho sơ đồ ghế
//   applyTransform(): void {
//     const seatMap = document.querySelector('.seat-map-content') as HTMLElement;
//     if (seatMap) {
//       seatMap.style.transform = `scale(${this.currentZoom}) translate(${this.translateX}px, ${this.translateY}px)`;
//     }
//   }

//   // Bắt đầu kéo sơ đồ
//   startDrag(event: Event): void {
//     const mouseEvent = event as MouseEvent;
//     if (this.currentZoom > 1) {
//       this.isDragging = true;
//       this.startX = mouseEvent.clientX;
//       this.startY = mouseEvent.clientY;
//     }
//   }

//   // Kéo sơ đồ
//   drag(event: Event): void {
//     const mouseEvent = event as MouseEvent;
//     if (!this.isDragging || this.currentZoom <= 1) return;

//     const deltaX = (mouseEvent.clientX - this.startX) / this.currentZoom;
//     const deltaY = (mouseEvent.clientY - this.startY) / this.currentZoom;
//     this.translateX += deltaX;
//     this.translateY += deltaY;
//     this.startX = mouseEvent.clientX;
//     this.startY = mouseEvent.clientY;
//     this.applyTransform();
//   }

//   // Kết thúc kéo
//   endDrag(): void {
//     this.isDragging = false;
//   }

//   // Xử lý sự kiện cuộn chuột
//   handleWheel(event: Event): void {
//     const wheelEvent = event as WheelEvent;
//     wheelEvent.preventDefault();
//     if (wheelEvent.deltaY < 0) {
//       this.zoomIn();
//     } else {
//       this.zoomOut();
//     }
//   }

//   goBack(): void {
//     // Nếu người dùng đã chọn ghế, hiển thị dialog xác nhận
//     if (this.selectedSeats.length > 0) {
//       const dialogRef = this.dialog.open(ConfirmDialogComponent, {
//         data: {
//           title: 'Xác nhận quay lại',
//           message: 'Nếu quay lại, thông tin ghế đã chọn sẽ bị mất. Bạn có chắc chắn muốn tiếp tục? (NGHĨA CHƯA ĐỔI CÁI NÀY THÀNH SWEETALERT VÀ THÔNG BÁO NÀY LÀ FAKE)'
//         },
//         width: '400px',
//         panelClass: 'custom-dialog'
//       });

//       dialogRef.afterClosed().subscribe(result => {
//         if (result) {
//           this.location.back();
//         }
//       });
//     } else {
//       this.location.back();
//     }
//   }

//   // Thay thế phương thức ngAfterViewInit
//   ngAfterViewInit(): void {
//     if (this.seatMapContainer?.nativeElement) {
//       const element = this.seatMapContainer.nativeElement;

//       // Thêm các sự kiện cho tính năng zoom và drag
//       this.addEventListenerWithCleanup(element, 'wheel', this.handleWheel.bind(this), { passive: false });
//       this.addEventListenerWithCleanup(element, 'mousedown', this.startDrag.bind(this));
//       this.addEventListenerWithCleanup(element, 'mousemove', this.drag.bind(this));
//       this.addEventListenerWithCleanup(element, 'mouseup', this.endDrag.bind(this));
//       this.addEventListenerWithCleanup(element, 'mouseleave', this.endDrag.bind(this));

//       // Thêm hỗ trợ cho thiết bị di động
//       // this.addEventListenerWithCleanup(element, 'touchstart', this.handleTouchStart.bind(this));
//       // this.addEventListenerWithCleanup(element, 'touchmove', this.handleTouchMove.bind(this));
//       this.addEventListenerWithCleanup(element, 'touchend', this.endDrag.bind(this));
//     }
//   }

//   // Giữ nguyên phương thức này
//   private addEventListenerWithCleanup(
//     element: HTMLElement,
//     eventName: string,
//     handler: EventListener,
//     options?: AddEventListenerOptions
//   ): void {
//     element.addEventListener(eventName, handler, options);
//     this.eventListeners.push(() => {
//       element.removeEventListener(eventName, handler, options);
//     });
//   }

// }