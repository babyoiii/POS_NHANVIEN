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

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private cinemaService: CinemaService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object // Inject PLATFORM_ID
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
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
    this.selectedProvince = province;
    this.cinemaService.getCinemasByProvinceId(province.id).subscribe(cinemas => {
      this.cinemas = cinemas;
      this.showProvinceSelection = false;
      this.showCinemaListSelection = true;
    });
  }

  selectCinema(cinema: Cinema): void {
    this.selectedCinema = cinema;
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
    if (this.loginForm.valid && this.selectedCinema) {
      const { email, password } = this.loginForm.value;
      
      this.authService.login(email, password).subscribe({
        next: (user) => {
          // Thêm animation fade-out
          const container = document.querySelector('.login-container') as HTMLElement;
          if (container) {
            container.classList.add('fade-out');
          }
          
          setTimeout(() => {
            // Chuyển hướng dựa trên vai trò
            if (user.role === 'manager') {
              this.router.navigate(['/manager/dashboard']);
            } else if (user.role === 'staff') {
              this.router.navigate(['/staff/dashboard']);
            } else {
              this.router.navigate(['/home']);
            }
          }, 500);
        },
        error: (error) => {
          console.error('Đăng nhập thất bại', error);
          alert('Tài khoản hoặc mật khẩu không chính xác!');
        }
      });
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
