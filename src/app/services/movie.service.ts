import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Genre {
  genreId: string;
  genreName: string;
}

export interface ApiGenre {
  id: string;
  genreName: string;
  status: number;
}

export interface Showtime {
  showtimeId: string;
  roomId: string;
  roomName: string;
  cinemaId: string;
  startTime: string;
  endTime: string;
  status: number;
  seatPrice: number;
}

export interface Movie {
  movieId: string;
  movieName: string;
  description: string;
  thumbnail: string;
  banner: string;
  trailer: string;
  duration: number;
  status: number;
  releaseDate: string;
  genres: Genre[];
  showtimes: Showtime[];
}

export interface ApiResponse<T> {
  responseCode: number;
  message: string;
  data: T;
  totalRecord?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MovieService {
  private readonly API_URL = 'https://localhost:7263/api/Counter';
  private readonly GENRE_API_URL = 'https://localhost:7263/api/Genre';
  
  constructor(private http: HttpClient) {}

  // Lấy danh sách thể loại phim từ API
  getGenreList(currentPage: number = 1, recordPerPage: number = 20): Observable<ApiResponse<ApiGenre[]>> {
    return this.http.get<ApiResponse<ApiGenre[]>>(
      `${this.GENRE_API_URL}/GetGenreList?currentPage=${currentPage}&recordPerPage=${recordPerPage}`
    );
  }

  getNowPlayingMovies(currentPage: number = 1, recordPerPage: number = 10, 
                     showDate?: Date, cinemaId?: string): Observable<ApiResponse<Movie[]>> {
    let url = `${this.API_URL}/GetNowPlayingMoviesFormatted?currentPage=${currentPage}&recordPerPage=${recordPerPage}`;
    
    if (cinemaId) {
      url += `&cinemaId=${cinemaId}`;
    }
    
    if (showDate) {
      url += `&showDate=${showDate.toISOString().split('T')[0]}`;
    }
    
    return this.http.get<ApiResponse<Movie[]>>(url);
  }

  // Phương thức này lọc phim theo ngày (cho component phim đang chiếu)
  getShowtimesByDate(movies: Movie[], date: Date): Movie[] {
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    return movies.map(movie => {
      // Lọc showtimes chỉ trong ngày đã chọn
      const filteredShowtimes = movie.showtimes.filter(showtime => {
        const showtimeDate = new Date(showtime.startTime);
        return showtimeDate.getDate() === selectedDate.getDate() &&
               showtimeDate.getMonth() === selectedDate.getMonth() &&
               showtimeDate.getFullYear() === selectedDate.getFullYear();
      });
      
      // Trả về phim với showtimes đã lọc
      return {
        ...movie,
        showtimes: filteredShowtimes
      };
    }).filter(movie => movie.showtimes.length > 0); // Chỉ giữ phim có lịch chiếu trong ngày đã chọn
  }

  // Phương thức này lọc phim theo thể loại (cho component phim sắp chiếu)
  filterMoviesByGenre(movies: Movie[], genreFilter: string): Movie[] {
    if (genreFilter === 'all') return movies;
    
    return movies.filter(movie => {
      // Kiểm tra xem phim có thể loại phù hợp không
      return movie.genres.some(genre => 
        genre.genreName.toLowerCase().includes(genreFilter.toLowerCase())
      );
    });
  }

  // Format thời gian để hiển thị
  formatShowtime(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    return date.getHours().toString().padStart(2, '0') + ':' + 
           date.getMinutes().toString().padStart(2, '0');
  }

  // Lấy phim sắp chiếu (chưa đến giờ chiếu)
  getUpcomingMovies(movies: Movie[]): Movie[] {
    const now = new Date();
    
    return movies.map(movie => {
      // Lọc showtime chưa đến giờ chiếu
      const upcomingShowtimes = movie.showtimes.filter(showtime => {
        const showtimeStart = new Date(showtime.startTime);
        return showtimeStart > now;
      });
      
      // Sắp xếp showtime theo thời gian chiếu tăng dần
      const sortedShowtimes = upcomingShowtimes.sort((a, b) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
      
      // Trả về phim với showtimes đã lọc và sắp xếp
      return {
        ...movie,
        showtimes: sortedShowtimes
      };
    }).filter(movie => movie.showtimes.length > 0); // Chỉ giữ phim có lịch chiếu sắp tới
  }
  
  // Kiểm tra xem phim có thể đặt vé trước không (2 tuần trước khi chiếu)
  canPreorderMovie(movie: Movie): boolean {
    if (!movie.showtimes || movie.showtimes.length === 0) return false;
    
    // Tìm suất chiếu sớm nhất
    const earliestShowtime = movie.showtimes.reduce((earliest, current) => {
      const timeA = new Date(earliest.startTime).getTime();
      const timeB = new Date(current.startTime).getTime();
      return timeA < timeB ? earliest : current;
    }, movie.showtimes[0]);
    
    const now = new Date();
    const showtimeStart = new Date(earliestShowtime.startTime);
    
    // Tính số mili giây giữa hiện tại và suất chiếu sớm nhất
    const timeUntilShowtime = showtimeStart.getTime() - now.getTime();
    
    // 2 tuần = 14 ngày * 24 giờ * 60 phút * 60 giây * 1000 mili giây
    const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
    
    // Có thể đặt vé trước nếu suất chiếu trong phạm vi 2 tuần
    return timeUntilShowtime <= twoWeeksInMs;
  }
  
  // Kiểm tra xem phim sắp mở đặt vé (1-2 ngày trước khi đến hạn đặt vé)
  isComingSoonToPreorder(movie: Movie): boolean {
    if (!movie.showtimes || movie.showtimes.length === 0) return false;
    
    // Tìm suất chiếu sớm nhất
    const earliestShowtime = movie.showtimes.reduce((earliest, current) => {
      const timeA = new Date(earliest.startTime).getTime();
      const timeB = new Date(current.startTime).getTime();
      return timeA < timeB ? earliest : current;
    }, movie.showtimes[0]);
    
    const now = new Date();
    const showtimeStart = new Date(earliestShowtime.startTime);
    
    // Tính số mili giây giữa hiện tại và suất chiếu sớm nhất
    const timeUntilShowtime = showtimeStart.getTime() - now.getTime();
    
    // 2 tuần = 14 ngày * 24 giờ * 60 phút * 60 giây * 1000 mili giây
    const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
    
    // 12 ngày = 12 * 24 * 60 * 60 * 1000 (2 ngày trước hạn đặt vé)
    const twelveToFourteenDaysInMs = 12 * 24 * 60 * 60 * 1000;
    
    // Sắp mở đặt vé: từ 12-14 ngày trước suất chiếu (1-2 ngày trước khi có thể đặt vé)
    return timeUntilShowtime > twoWeeksInMs && timeUntilShowtime <= twoWeeksInMs + (2 * 24 * 60 * 60 * 1000);
  }
  
  // Phân loại phim theo category (opening: đang mở đặt trước, coming: sắp mở đặt trước)
  filterMoviesByPreorderStatus(movies: Movie[], category: 'opening' | 'coming'): Movie[] {
    return movies.filter(movie => {
      if (category === 'opening') {
        return this.canPreorderMovie(movie);
      } else {
        return this.isComingSoonToPreorder(movie);
      }
    });
  }
} 