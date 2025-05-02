import { Component, OnInit, ViewEncapsulation, Inject, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CinemaService } from '../../services/cinema.service';
import { AuthService } from '../../services/auth.service';
import { Province, Cinema, User } from '../../models/cinema.model';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  encapsulation: ViewEncapsulation.Emulated,
  imports: [CommonModule, ReactiveFormsModule]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  provinces: Province[] = [];
  cinemas: Cinema[] = [];
  showCinemaSelection = false;
  showProvinceSelection = true;
  showCinemaListSelection = false;
  selectedProvince: Province | null = null;
  selectedCinema: Cinema | null = null;
  loginVisible = false;
  noCinemasFound = false;
  selectedProvinceId: number | null = null;
  errorMessage: string = '';
  showCinemaError: boolean = false;
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private cinemaService: CinemaService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object // Inject PLATFORM_ID
  ) {
    this.loginForm = this.fb.group({
      userName: ['', [Validators.required]],
      passWord: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.createFloatingElements();
    this.loadProvinces();
  }

  loadProvinces(): void {
    this.cinemaService.getProvinces().subscribe(provinces => {
      this.provinces = provinces;
    });
  }

  showCinemas(province: Province): void {
    console.log('showCinemas được gọi với province:', province);
    this.selectedProvinceId = province.id;
    this.selectedProvince = province;
    this.noCinemasFound = false;
    this.showProvinceSelection = false;
    this.showCinemaListSelection = true;

    this.cinemaService.getCinemasByProvince(province.id).subscribe(
      (cinemas) => {
        console.log(`Danh sách rạp (${cinemas.length} rạp):`, cinemas);
        this.cinemas = cinemas;
        
        // Hiển thị thông báo nếu không có rạp cho tỉnh đã chọn
        if (cinemas.length === 0) {
          console.log('Không tìm thấy rạp cho tỉnh:', province.name);
          this.noCinemasFound = true;
        } else {
          this.noCinemasFound = false;
        }
      },
      (error) => {
        console.error('Lỗi khi lấy danh sách rạp:', error);
        this.cinemas = [];
        this.noCinemasFound = true;
      }
    );
  }

  selectCinema(cinema: Cinema): void {
    console.log('Đã chọn rạp:', cinema);
    this.selectedCinema = cinema;
    
    // Lưu thông tin rạp đã chọn vào localStorage
    this.cinemaService.saveSelectedCinema(cinema);
    
    this.showCinemaSelection = false;
    this.loginVisible = true;
  }

  showCinemaSelector(): void {
    this.showCinemaSelection = true;
    this.showProvinceSelection = true;
    this.showCinemaListSelection = false;
  }

  closeCinemaSelection(): void {
    this.showCinemaSelection = false;
  }

  backToProvinces(): void {
    this.showProvinceSelection = true;
    this.showCinemaListSelection = false;
  }

  onSubmit(): void {
    this.showCinemaError = false;
    if (this.loginForm.valid && this.selectedCinema) {
      this.isLoading = true;
      this.errorMessage = '';
      const { userName, passWord } = this.loginForm.value;
      
      console.log('Login form submitted with:', { userName });
      
      this.authService.login(userName, passWord).subscribe({
        next: (user) => {
          this.isLoading = false;
          // Lưu thông tin user đã đăng nhập
          console.log('Đăng nhập thành công với người dùng:', user);
          console.log('Rạp đã chọn:', this.selectedCinema);
          
          // Thêm animation fade-out
          const container = document.querySelector('.login-container') as HTMLElement;
          if (container) {
            container.classList.add('fade-out');
          }
          
          setTimeout(() => {
            // Điều hướng đến trang chủ sau khi đăng nhập thành công
            this.router.navigate(['/trangchu']);
          }, 500);
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Đăng nhập thất bại', error);
          console.error('Error type:', typeof error);
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
          this.errorMessage = 'Tài khoản hoặc mật khẩu không chính xác!';
        }
      });
    } else if (this.loginForm.valid && !this.selectedCinema) {
      this.showCinemaError = true;
    }
  }

  createFloatingElements(): void {
    // Kiểm tra nếu đang chạy trong trình duyệt
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const icons = [
      'fa-film',
      'fa-video',
      'fa-ticket',
      'fa-clapperboard',
      'fa-masks-theater',
      'fa-tv',
      'fa-camera',
      'fa-star',
      'fa-couch',
      'fa-photo-film'
    ];
    
    const container = document.querySelector('.floating-icons');
    if (!container) return;

    for (let i = 0; i < 20; i++) {
      const icon = document.createElement('i');
      const randomIcon = icons[Math.floor(Math.random() * icons.length)];
      icon.className = `fas ${randomIcon} floating-icon`;
      icon.style.left = `${Math.random() * 100}%`;
      icon.style.animationDuration = `${Math.random() * 10 + 10}s`;
      icon.style.animationDelay = `${Math.random() * 5}s`;
      container.appendChild(icon);
    }

    setTimeout(() => {
      document.querySelectorAll('.floating-icon').forEach(el => {
        (el as HTMLElement).style.opacity = '1';
      });
    }, 500);
  }
}
