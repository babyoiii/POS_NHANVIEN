//cinema.service.ts
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Province, Cinema } from '../models/cinema.model';

@Injectable({
  providedIn: 'root'
})
export class CinemaService {
  // Fake data cho tỉnh thành
  private provinces: Province[] = [
    { id: 1, name: 'Hà Nội' },
    { id: 2, name: 'Hồ Chí Minh' },
    { id: 3, name: 'Đà Nẵng' },
    { id: 4, name: 'Hải Phòng' },
    { id: 5, name: 'Cần Thơ' },
    { id: 6, name: 'Huế' },
    { id: 7, name: 'Nha Trang' },
    { id: 8, name: 'Bình Dương' },
    { id: 9, name: 'Quảng Ninh' },
    { id: 10, name: 'Nghệ An' }
  ];

  // Fake data cho rạp chiếu phim
  private cinemas: Cinema[] = [
    { id: 1, provinceId: 1, name: 'AEON Hà Đông', address: '30 Lê Trọng Tấn, Hà Đông, Hà Nội' },
    { id: 2, provinceId: 1, name: 'Vincom Royal City', address: '72A Nguyễn Trãi, Thanh Xuân, Hà Nội' },
    { id: 3, provinceId: 1, name: 'Vincom Bà Triệu', address: '191 Bà Triệu, Hai Bà Trưng, Hà Nội' },
    { id: 4, provinceId: 1, name: 'Lotte Thăng Long', address: '54 Liễu Giai, Ba Đình, Hà Nội' },
    { id: 5, provinceId: 1, name: 'Vincom Times City', address: '458 Minh Khai, Hai Bà Trưng, Hà Nội' },
    
    { id: 6, provinceId: 2, name: 'Vincom Thảo Điền', address: '159 Xa lộ Hà Nội, Thảo Điền, Quận 2, TP.HCM' },
    { id: 7, provinceId: 2, name: 'AEON Tân Phú', address: '30 Bờ Bao Tân Thắng, Tân Phú, TP.HCM' },
    { id: 8, provinceId: 2, name: 'CGV Crescent Mall', address: '101 Tôn Dật Tiên, Quận 7, TP.HCM' },
    { id: 9, provinceId: 2, name: 'Lotte Nowzone', address: '235 Nguyễn Văn Cừ, Quận 1, TP.HCM' },
    { id: 10, provinceId: 2, name: 'CGV Sư Vạn Hạnh', address: '11 Sư Vạn Hạnh, Quận 10, TP.HCM' },
    
    { id: 11, provinceId: 3, name: 'Vincom Đà Nẵng', address: '910 Ngô Quyền, Sơn Trà, Đà Nẵng' },
    { id: 12, provinceId: 3, name: 'Lotte Mart Đà Nẵng', address: '6 Hùng Vương, Hải Châu, Đà Nẵng' },
    { id: 13, provinceId: 3, name: 'CGV Vincom Đà Nẵng', address: '120 Nguyễn Hữu Thọ, Hải Châu, Đà Nẵng' },
    
    { id: 14, provinceId: 4, name: 'Vincom Imperia Hải Phòng', address: '10 Lê Hồng Phong, Hải Phòng' },
    { id: 15, provinceId: 4, name: 'CGV Vincom Hải Phòng', address: '4 Lê Thánh Tông, Hải Phòng' },
    
    { id: 16, provinceId: 5, name: 'Lotte Cần Thơ', address: '84 Mậu Thân, Ninh Kiều, Cần Thơ' },
    { id: 17, provinceId: 5, name: 'CGV Sense City', address: '1 Hòa Bình, Ninh Kiều, Cần Thơ' },
    
    { id: 18, provinceId: 6, name: 'Vincom Huế', address: '50 Hùng Vương, Phú Nhuận, Huế' },
    { id: 19, provinceId: 6, name: 'Lotte Huế', address: '15 Lê Lợi, Vĩnh Ninh, Huế' },
    
    { id: 20, provinceId: 7, name: 'Vincom Nha Trang', address: '78 Trần Phú, Lộc Thọ, Nha Trang' },
    { id: 21, provinceId: 7, name: 'Lotte Nha Trang', address: '35 Lê Đại Hành, Nha Trang' },
    
    { id: 22, provinceId: 8, name: 'AEON Bình Dương', address: '27 Đại lộ Bình Dương, Thuận An, Bình Dương' },
    { id: 23, provinceId: 8, name: 'Vincom Thủ Dầu Một', address: '42 Lý Thường Kiệt, Thủ Dầu Một, Bình Dương' },
    
    { id: 24, provinceId: 9, name: 'Vincom Hạ Long', address: '1 Cái Dăm, Bãi Cháy, Hạ Long, Quảng Ninh' },
    { id: 25, provinceId: 9, name: 'CGV Hạ Long', address: '9 Trần Quốc Nghiễn, Hạ Long, Quảng Ninh' },
    
    { id: 26, provinceId: 10, name: 'Vincom Vinh', address: '76 Quang Trung, Vinh, Nghệ An' },
    { id: 27, provinceId: 10, name: 'CGV Vinh', address: '21 Quang Trung, Vinh, Nghệ An' }
  ];

  constructor() { }

  getProvinces(): Observable<Province[]> {
    // Mô phỏng API call
    return of(this.provinces);
  }

  getCinemasByProvinceId(provinceId: number): Observable<Cinema[]> {
    // Mô phỏng API call
    const filteredCinemas = this.cinemas.filter(cinema => cinema.provinceId === provinceId);
    return of(filteredCinemas);
  }
}
