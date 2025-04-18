import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { PermissionService } from '../../services/permission.service';
import { AuthService } from '../../services/auth.service';
import { CinemaService } from '../../services/cinema.service';
import { Cinema } from '../../models/cinema.model';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-slidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './slidebar.component.html',
  styleUrl: './slidebar.component.css'
})
export class SlidebarComponent implements OnInit {
  selectedCinema: Cinema | null = null;
  activeRoute: string = '';

  constructor(
    private permissionService: PermissionService,
    private authService: AuthService,
    private cinemaService: CinemaService,
    private router: Router
  ) {
    // Theo dõi sự thay đổi route để cập nhật activeRoute
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects || event.url;
      // Lấy phần path cuối cùng của URL (ví dụ: từ /trangchu/ticket => ticket)
      const segments = url.split('/');
      this.activeRoute = segments[segments.length - 1];
      
      // Xử lý trường hợp route mặc định
      if (this.activeRoute === 'trangchu') {
        this.activeRoute = 'ticket';
      }
      
      console.log('Active route:', this.activeRoute);
    });
  }

  ngOnInit(): void {
    // Lấy thông tin rạp đã chọn từ localStorage
    this.selectedCinema = this.cinemaService.getSelectedCinema();
    
    // Khởi tạo activeRoute ban đầu
    const currentUrl = this.router.url;
    const segments = currentUrl.split('/');
    this.activeRoute = segments[segments.length - 1];
    
    // Xử lý trường hợp route mặc định
    if (this.activeRoute === 'trangchu') {
      this.activeRoute = 'ticket';
    }
    
    console.log('Initial active route:', this.activeRoute);
  }

  // Kiểm tra xem một menu item có đang active hay không
  isActive(route: string): boolean {
    console.log(`Checking if ${route} is active. Current activeRoute: ${this.activeRoute}`);
    if (route === 'ticket' && (this.activeRoute === 'ticket' || this.activeRoute === 'trangchu')) {
      return true;
    }
    return this.activeRoute === route;
  }

  // Phương thức mở QR code trong tab mới
  openQRCodeInNewTab() {
    window.open('/qr', '_blank');
  }

  // Kiểm tra quyền
  hasPermission(permission: string): boolean {
    return this.permissionService.hasPermission(permission);
  }

  // Lấy tên người dùng hiện tại
  get currentUser() {
    return this.authService.getCurrentUser();
  }
  
  // Phương thức đăng xuất
  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        // Xóa thông tin rạp đã chọn khi đăng xuất
        this.cinemaService.clearSelectedCinema();
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Đăng xuất thất bại', error);
      }
    });
  }
}
