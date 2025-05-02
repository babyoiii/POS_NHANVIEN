import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CinemaService } from '../../services/cinema.service';

interface CinemaSetting {
  name: string;
  branchCode: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
  dateFormat: string;
}

interface OperationalSetting {
  allowPreorder: boolean;
  autoCancelUnpaidTickets: boolean;
  ticketHoldTime: number;
  allowRefunds: boolean;
  refundTimeLimit: number;
}

@Component({
  selector: 'app-setting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setting.component.html',
  styleUrl: './setting.component.css'
})
export class SettingComponent implements OnInit {
  public activeSection: string = 'cinema';
  
  // Cinema Settings
  public cinemaSetting: CinemaSetting = {
    name: '',
    branchCode: '',
    phone: '',
    email: '',
    address: '',
    timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
    dateFormat: 'DD/MM/YYYY'
  };
  
  // Operational Settings
  public operationalSetting: OperationalSetting = {
    allowPreorder: true,
    autoCancelUnpaidTickets: true,
    ticketHoldTime: 15,
    allowRefunds: true,
    refundTimeLimit: 24
  };
  
  // Flags
  public isLoading: boolean = false;
  public saveSuccess: boolean = false;
  public errorMessage: string = '';
  
  constructor(
    private cinemaService: CinemaService,
    private authService: AuthService,
    private router: Router
  ) {}
  
  public ngOnInit(): void {
    // Kiểm tra quyền admin
    if (!this.authService.hasRole('Admin')) {
      this.router.navigate(['/']);
      return;
    }
    
    this.loadCinemaSettings();
  }
  
  public loadCinemaSettings(): void {
    this.isLoading = true;
    
    // Lấy thông tin rạp từ cinema service
    const selectedCinema = this.cinemaService.getSelectedCinema();
    if (selectedCinema) {
      this.cinemaSetting.name = selectedCinema.name;
      this.cinemaSetting.address = selectedCinema.address;
      this.cinemaSetting.phone = selectedCinema.phoneNumber || '';
      
      // Mã chi nhánh có thể được phân tách từ tên
      const nameParts = selectedCinema.name.split(' ');
      if (nameParts.length > 2) {
        const city = nameParts[nameParts.length - 1];
        this.cinemaSetting.branchCode = `${city.substring(0, 3)}-001`.toUpperCase();
      }
    }
    
    // Tải các cài đặt được lưu trữ trong localStorage
    this.loadSavedSettings();
    
    this.isLoading = false;
  }
  
  private loadSavedSettings(): void {
    const savedOperationalSettings = localStorage.getItem('operationalSettings');
    if (savedOperationalSettings) {
      try {
        const operSettings = JSON.parse(savedOperationalSettings);
        this.operationalSetting = { ...this.operationalSetting, ...operSettings };
      } catch (e) {
        console.error('Lỗi khi parse cài đặt vận hành:', e);
      }
    }
  }
  
  public saveSettings(): void {
    this.isLoading = true;
    this.saveSuccess = false;
    this.errorMessage = '';
    
    try {
      // Lưu thông tin rạp
      const cinemaToSave = {
        id: 'local-cinema',
        name: this.cinemaSetting.name,
        address: this.cinemaSetting.address,
        phoneNumber: this.cinemaSetting.phone,
        totalRooms: 5, // Giá trị mặc định
        status: 1 // Giá trị mặc định
      };
      
      this.cinemaService.saveSelectedCinema(cinemaToSave);
      
      // Lưu cài đặt vận hành
      localStorage.setItem('operationalSettings', JSON.stringify(this.operationalSetting));
      
      this.saveSuccess = true;
      setTimeout(() => {
        this.saveSuccess = false;
      }, 3000);
    } catch (e) {
      console.error('Lỗi khi lưu cài đặt:', e);
      this.errorMessage = 'Đã xảy ra lỗi khi lưu cài đặt. Vui lòng thử lại.';
    } finally {
      this.isLoading = false;
    }
  }
  
  public setActiveSection(section: string): void {
    this.activeSection = section;
  }
  
  public resetSettings(): void {
    if (confirm('Bạn có chắc chắn muốn hủy tất cả thay đổi?')) {
      this.loadCinemaSettings();
    }
  }
}
