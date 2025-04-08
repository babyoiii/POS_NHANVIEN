import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Movie {
  id: number;
  title: string;
  duration: number;
  genre: string;
  posterUrl: string;
  showtimes: string[];
}

@Component({
  selector: 'app-phim-dang-chieu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './phim-dang-chieu.component.html',
  styleUrl: './phim-dang-chieu.component.css'
})
export class PhimDangChieuComponent implements OnInit {
  // Mảng ngày hiển thị (7 ngày từ ngày hiện tại)
  dates: { date: Date, formatted: string }[] = [];
  selectedDate: Date = new Date();
  
  // Danh sách phim
  movies: Movie[] = [
    {
      id: 1,
      title: 'Avengers: Endgame',
      duration: 181,
      genre: 'Hành động',
      posterUrl: 'https://amc-theatres-res.cloudinary.com/image/upload/c_limit,w_272/f_auto/q_auto/v1732555414/amc-cdn/production/2/movies/76800/76827/PosterDynamic/168263.jpg',
      showtimes: ['10:30', '13:45', '17:00', '20:15']
    },
    {
      id: 2,
      title: 'Joker',
      duration: 122,
      genre: 'Tâm lý',
      posterUrl: 'https://amc-theatres-res.cloudinary.com/image/upload/c_limit,w_272/f_auto/q_auto/v1732555414/amc-cdn/production/2/movies/76800/76827/PosterDynamic/168263.jpg',
      showtimes: ['11:00', '14:15', '17:30', '20:45']
    },
    {
      id: 3,
      title: 'Parasite',
      duration: 132,
      genre: 'Kinh dị',
      posterUrl: 'https://amc-theatres-res.cloudinary.com/image/upload/c_limit,w_272/f_auto/q_auto/v1732555414/amc-cdn/production/2/movies/76800/76827/PosterDynamic/168263.jpg',
      showtimes: ['10:00', '13:15', '16:30', '19:45']
    },
    {
      id: 4,
      title: 'Inception',
      duration: 148,
      genre: 'Viễn tưởng',
      posterUrl: 'https://amc-theatres-res.cloudinary.com/image/upload/c_limit,w_272/f_auto/q_auto/v1732555414/amc-cdn/production/2/movies/76800/76827/PosterDynamic/168263.jpg',
      showtimes: ['09:30', '12:45', '16:00', '19:15']
    },
    {
      id: 5,
      title: 'The Dark Knight',
      duration: 152,
      genre: 'Hành động',
      posterUrl: 'https://amc-theatres-res.cloudinary.com/image/upload/c_limit,w_272/f_auto/q_auto/v1732555414/amc-cdn/production/2/movies/76800/76827/PosterDynamic/168263.jpg',
      showtimes: ['10:15', '13:30', '16:45', '20:00']
    },
    {
      id: 6,
      title: 'Interstellar',
      duration: 169,
      genre: 'Khoa học viễn tưởng',
      posterUrl: 'https://amc-theatres-res.cloudinary.com/image/upload/c_limit,w_272/f_auto/q_auto/v1732555414/amc-cdn/production/2/movies/76800/76827/PosterDynamic/168263.jpg',
      showtimes: ['11:30', '14:45', '18:00', '21:15']
    }
  ];

  ngOnInit(): void {
    this.generateDateSelector();
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

  // Chọn ngày
  selectDate(date: Date): void {
    this.selectedDate = date;
    // Ở đây bạn có thể thêm logic để lọc phim theo ngày nếu cần
  }

  // Kiểm tra xem ngày có được chọn không
  isDateSelected(date: Date): boolean {
    return date.getDate() === this.selectedDate.getDate() && 
           date.getMonth() === this.selectedDate.getMonth() && 
           date.getFullYear() === this.selectedDate.getFullYear();
  }
}
