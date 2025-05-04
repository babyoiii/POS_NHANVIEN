import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MovieService, Movie } from '../../../services/movie.service';
import { Router } from '@angular/router';
import { SearchService } from '../../../services/search.service';
import { Subscription } from 'rxjs';

interface DateObject {
  date: Date;
  formatted: string;
}

@Component({
  selector: 'app-phim-dang-chieu',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './phim-dang-chieu.component.html',
  styleUrl: './phim-dang-chieu.component.css',
  providers: [MovieService]
})
export class PhimDangChieuComponent implements OnInit, OnDestroy {
  // Mảng ngày hiển thị (7 ngày từ ngày hiện tại)
  dates: DateObject[] = [];
  selectedDate: Date = new Date();
  
  // Danh sách phim
  allMovies: Movie[] = [];
  filteredMovies: Movie[] = []; // Filtered by date
  movies: Movie[] = []; // Filtered by date and search
  isLoading: boolean = true;
  errorMessage: string = '';
  
  // Search related
  private searchSubscription: Subscription | null = null;
  currentSearchTerm: string = '';

  constructor(
    private movieService: MovieService, 
    private router: Router,
    private searchService: SearchService
  ) {}

  ngOnInit(): void {
    this.generateDateSelector();
    this.loadMovies();
    
    // Subscribe to search query changes
    this.searchSubscription = this.searchService.searchQuery$.subscribe(query => {
      this.currentSearchTerm = query;
      this.filterMovies();
    });
  }
  
  ngOnDestroy(): void {
    // Clean up subscription
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  // Tạo bộ chọn ngày
  generateDateSelector(): void {
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      
      // Format ngày theo định dạng "Thứ, DD/MM"
      const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
      const dayName = dayNames[date.getDay()];
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      
      const formatted = i === 0 ? 'Hôm nay' : `${dayName}, ${day}/${month}`;
      
      this.dates.push({ date, formatted });
    }
  }

  // Lấy danh sách phim từ API
  loadMovies(): void {
    this.isLoading = true;
    
    // ID của rạp - lấy từ localStorage hoặc service tùy vào ứng dụng của bạn
    const cinemaId = localStorage.getItem('selectedCinemaId') || 'e2131050-d219-4523-b480-2f517d8bafd0';
    
    this.movieService.getNowPlayingMovies(1, 20, this.selectedDate, cinemaId)
      .subscribe({
        next: (response) => {
          if (response.responseCode === 200) {
            this.allMovies = response.data;
            // Lọc phim theo ngày đã chọn
            this.filterMoviesByDate();
          } else {
            this.errorMessage = response.message || 'Có lỗi xảy ra khi tải dữ liệu';
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = 'Không thể kết nối với máy chủ';
          this.isLoading = false;
          console.error('API error:', error);
        }
      });
  }

  // Lọc phim theo ngày đã chọn
  filterMoviesByDate(): void {
    this.filteredMovies = this.movieService.getShowtimesByDate(this.allMovies, this.selectedDate);
    this.filterMovies();
  }
  
  // Apply both date and search filters
  filterMovies(): void {
    // First filter by date
    if (this.currentSearchTerm) {
      // Then apply search filter if there's a search term
      this.movies = this.searchService.filterMovies(this.filteredMovies, this.currentSearchTerm);
    } else {
      this.movies = [...this.filteredMovies];
    }
  }

  // Chọn ngày
  selectDate(date: Date): void {
    this.selectedDate = date;
    // Nếu đã có dữ liệu, lọc lại theo ngày
    if (this.allMovies.length > 0) {
      this.filterMoviesByDate();
    } else {
      // Nếu chưa có dữ liệu, tải lại từ API
      this.loadMovies();
    }
  }

  // Kiểm tra xem ngày có được chọn không
  isDateSelected(date: Date): boolean {
    return date.getDate() === this.selectedDate.getDate() && 
           date.getMonth() === this.selectedDate.getMonth() && 
           date.getFullYear() === this.selectedDate.getFullYear();
  }

  // Format thời gian chiếu phim
  formatShowtime(showtime: string): string {
    return this.movieService.formatShowtime(showtime);
  }
  
  // Format thời gian chiếu phim với cả ngày tháng
  formatShowtimeWithDate(showtime: string): string {
    const date = new Date(showtime);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month} - ${hours}:${minutes}`;
  }

  // Kết hợp các thể loại thành chuỗi
  getGenresString(movie: Movie): string {
    return movie.genres.map(g => g.genreName).join(', ');
  }

  // Điều hướng đến trang sơ đồ ghế khi click vào suất chiếu
  navigateToSeatMap(showtimeId: string): void {
    console.log(`Navigating to seat map for showtime ID: ${showtimeId}`);
    // Lưu showTimeId vào localStorage để đảm bảo có thể truy cập khi cần
    localStorage.setItem('currentShowTimeId', showtimeId);
    this.router.navigate(['/trangchu/seat-map', showtimeId]);
  }
}
