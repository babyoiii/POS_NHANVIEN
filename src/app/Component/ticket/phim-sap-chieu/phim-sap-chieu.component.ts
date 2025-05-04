import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MovieService, Movie, ApiResponse, ApiGenre } from '../../../services/movie.service';
import { Router } from '@angular/router';
import { SearchService } from '../../../services/search.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-phim-sap-chieu',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './phim-sap-chieu.component.html',
  styleUrl: './phim-sap-chieu.component.css',
  providers: [MovieService]
})
export class PhimSapChieuComponent implements OnInit, OnDestroy {
  activeFilter: string = 'all';
  
  allMovies: Movie[] = [];
  filteredByCategory: Movie[] = []; // Filtered by category (all, opening, coming, genre)
  filteredMovies: Movie[] = []; // Final filtered list (category + search)
  isLoading: boolean = true;
  errorMessage: string = '';
  
  // Danh sách thể loại phim
  genres: ApiGenre[] = [];
  
  // Trạng thái hiển thị dropdown thể loại
  showGenreDropdown: boolean = false;
  
  // Search related
  private searchSubscription: Subscription | null = null;
  currentSearchTerm: string = '';

  constructor(
    private movieService: MovieService, 
    private router: Router,
    private searchService: SearchService
  ) {}

  ngOnInit(): void {
    this.loadGenres();
    this.loadMovies();
    
    // Đóng dropdown khi click ra ngoài
    document.addEventListener('click', this.closeDropdownOnClickOutside.bind(this));
    
    // Subscribe to search query changes
    this.searchSubscription = this.searchService.searchQuery$.subscribe(query => {
      this.currentSearchTerm = query;
      this.applySearchFilter();
    });
  }
  
  ngOnDestroy(): void {
    // Xóa event listener khi component bị hủy
    document.removeEventListener('click', this.closeDropdownOnClickOutside.bind(this));
    
    // Clean up subscription
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }
  
  // Đóng dropdown khi click ra ngoài
  closeDropdownOnClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-more-container')) {
      this.showGenreDropdown = false;
    }
  }
  
  // Mở/đóng dropdown
  toggleGenreDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation(); // Ngăn sự kiện click lan ra ngoài
    }
    this.showGenreDropdown = !this.showGenreDropdown;
  }

  // Tải danh sách thể loại từ API
  loadGenres(): void {
    this.movieService.getGenreList().subscribe({
      next: (response: ApiResponse<ApiGenre[]>) => {
        if (response.responseCode === 200 && response.data) {
          this.genres = response.data;
        }
      },
      error: (err: any) => {
        console.error('Lỗi khi tải danh sách thể loại phim:', err);
      }
    });
  }

  loadMovies(): void {
    this.isLoading = true;
    
    // ID của rạp - lấy từ localStorage hoặc service
    const cinemaId = localStorage.getItem('selectedCinemaId') || 'e2131050-d219-4523-b480-2f517d8bafd0';
    
    // Lấy tất cả phim
    this.movieService.getNowPlayingMovies(1, 50, undefined, cinemaId).subscribe({
      next: (response: ApiResponse<Movie[]>) => {
        if (response && response.data && response.data.length > 0) {
          // Lọc phim sắp chiếu (chưa đến giờ chiếu)
          this.allMovies = this.movieService.getUpcomingMovies(response.data);
          this.applyFilter(this.activeFilter);
        } else {
          this.allMovies = [];
          this.filteredByCategory = [];
          this.filteredMovies = [];
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        this.errorMessage = 'Không thể kết nối với máy chủ';
        this.isLoading = false;
        console.error('Error loading movies:', err);
      }
    });
  }

  setActiveFilter(filter: string): void {
    this.activeFilter = filter;
    this.applyFilter(filter);
  }

  isActive(filter: string): boolean {
    return this.activeFilter === filter;
  }

  applyFilter(filter: string): void {
    if (filter === 'all') {
      this.filteredByCategory = [...this.allMovies];
    } else if (filter === 'opening' || filter === 'coming') {
      // Phân loại dựa trên trạng thái đặt vé
      this.filteredByCategory = this.movieService.filterMoviesByPreorderStatus(this.allMovies, filter as 'opening' | 'coming');
    } else {
      // Lọc theo thể loại
      this.filteredByCategory = this.movieService.filterMoviesByGenre(this.allMovies, filter);
    }
    
    // Apply search filter after category filter
    this.applySearchFilter();
  }
  
  // Apply search filter to movies already filtered by category
  applySearchFilter(): void {
    if (this.currentSearchTerm) {
      this.filteredMovies = this.searchService.filterMovies(this.filteredByCategory, this.currentSearchTerm);
    } else {
      this.filteredMovies = [...this.filteredByCategory];
    }
  }

  // Định dạng ngày phát hành
  formatReleaseDate(releaseDate: string): string {
    if (!releaseDate) {
      return 'Đang cập nhật';
    }
    
    try {
      const date = new Date(releaseDate);
      
      // Kiểm tra xem ngày có hợp lệ không
      if (isNaN(date.getTime())) {
        return 'Đang cập nhật';
      }
      
      // Định dạng theo dd/MM/yyyy
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Đang cập nhật';
    }
  }

  // Kết hợp các thể loại thành chuỗi
  getGenresString(movie: Movie): string {
    return movie.genres.map(g => g.genreName).join(', ');
  }

  // Kiểm tra xem phim có thể đặt trước không (gói logic từ service)
  canPreorder(movie: Movie): boolean {
    return this.movieService.canPreorderMovie(movie);
  }
  
  // Lấy thời gian đến suất chiếu đầu tiên
  getTimeUntilFirstShowtime(movie: Movie): string {
    if (!movie.showtimes || movie.showtimes.length === 0) return '';
    
    // Tìm suất chiếu sớm nhất
    const earliestShowtime = movie.showtimes.reduce((earliest, current) => {
      const timeA = new Date(earliest.startTime).getTime();
      const timeB = new Date(current.startTime).getTime();
      return timeA < timeB ? earliest : current;
    }, movie.showtimes[0]);
    
    // Format ngày theo định dạng dd/MM/yyyy
    const date = new Date(earliestShowtime.startTime);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  }

  // Format thời gian chiếu phim (giống với component phim đang chiếu) 
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

  // Điều hướng đến trang sơ đồ ghế khi click vào nút đặt vé trước
  navigateToSeatMap(movie: Movie): void {
    if (!movie.showtimes || movie.showtimes.length === 0) {
      alert('Không có suất chiếu nào cho phim này!');
      return;
    }
    
    // Lấy suất chiếu đầu tiên
    const showtime = movie.showtimes[0];
    console.log(`Navigating to seat map for showtime ID: ${showtime.showtimeId}`);
    // Lưu showTimeId vào localStorage để đảm bảo có thể truy cập khi cần
    localStorage.setItem('currentShowTimeId', showtime.showtimeId);
    this.router.navigate(['/trangchu/seat-map', showtime.showtimeId]);
  }

  // Điều hướng đến trang sơ đồ ghế bằng ID suất chiếu
  navigateToSeatMapById(showtimeId: string): void {
    console.log(`Navigating to seat map for showtime ID: ${showtimeId}`);
    // Lưu showTimeId vào localStorage để đảm bảo có thể truy cập khi cần
    localStorage.setItem('currentShowTimeId', showtimeId);
    this.router.navigate(['/trangchu/seat-map', showtimeId]);
  }
}
