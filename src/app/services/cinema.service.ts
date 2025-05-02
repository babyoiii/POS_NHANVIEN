//cinema.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { Province, Cinema } from '../models/cinema.model';
import { isPlatformBrowser } from '@angular/common';

interface CinemaApiResponse {
  responseCode: number;
  message: string;
  data: {
    cinemasId: string;
    name: string;
    address: string;
    phoneNumber: string;
    totalRooms: number;
    status: number;
    createdDate: string;
    isDeleted: boolean;
  }[];
  totalRecord: number;
}

@Injectable({
  providedIn: 'root'
})
export class CinemaService {
  private provincesApiUrl = 'https://provinces.open-api.vn/api/';
  private apiUrl = 'https://localhost:7263/api';
  private selectedCinemaKey = 'selectedCinema';
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // Phương thức lưu thông tin rạp đã chọn
  saveSelectedCinema(cinema: Cinema): void {
    if (cinema && this.isBrowser) {
      console.log('Lưu thông tin rạp đã chọn:', cinema);
      localStorage.setItem(this.selectedCinemaKey, JSON.stringify(cinema));
    }
  }

  // Phương thức lấy thông tin rạp đã chọn
  getSelectedCinema(): Cinema | null {
    if (!this.isBrowser) {
      return null;
    }
    
    const cinemaStr = localStorage.getItem(this.selectedCinemaKey);
    if (cinemaStr) {
      try {
        return JSON.parse(cinemaStr);
      } catch (e) {
        console.error('Lỗi khi parse thông tin rạp từ localStorage:', e);
        return null;
      }
    }
    return null;
  }

  // Phương thức xóa thông tin rạp đã chọn
  clearSelectedCinema(): void {
    if (this.isBrowser) {
      localStorage.removeItem(this.selectedCinemaKey);
    }
  }

  getProvinces(): Observable<Province[]> {
    // Sử dụng dữ liệu mẫu cứng (hardcoded) thay vì gọi API bên ngoài để tránh lỗi CORS
    const mockProvinces: Province[] = [
      { id: 1, name: 'Hà Nội' },
      { id: 2, name: 'TP Hồ Chí Minh' },
      { id: 3, name: 'Đà Nẵng' },
      { id: 4, name: 'Hải Phòng' },
      { id: 5, name: 'Cần Thơ' },
      { id: 6, name: 'An Giang' },
      { id: 7, name: 'Bà Rịa - Vũng Tàu' },
      { id: 8, name: 'Bắc Giang' },
      { id: 9, name: 'Bắc Kạn' },
      { id: 10, name: 'Bạc Liêu' },
      { id: 11, name: 'Bắc Ninh' },
      { id: 12, name: 'Bến Tre' },
      { id: 13, name: 'Bình Định' },
      { id: 14, name: 'Bình Dương' },
      { id: 15, name: 'Bình Phước' },
      { id: 16, name: 'Bình Thuận' },
      { id: 17, name: 'Cà Mau' },
      { id: 18, name: 'Cao Bằng' },
      { id: 19, name: 'Đắk Lắk' },
      { id: 20, name: 'Đắk Nông' },
      { id: 21, name: 'Điện Biên' },
      { id: 22, name: 'Đồng Nai' },
      { id: 23, name: 'Đồng Tháp' },
      { id: 24, name: 'Gia Lai' },
      { id: 25, name: 'Hà Giang' },
      { id: 26, name: 'Hà Nam' },
      { id: 27, name: 'Hà Tĩnh' },
      { id: 28, name: 'Hải Dương' },
      { id: 29, name: 'Hậu Giang' },
      { id: 30, name: 'Hòa Bình' },
      { id: 31, name: 'Hưng Yên' },
      { id: 32, name: 'Khánh Hòa' },
      { id: 33, name: 'Kiên Giang' },
      { id: 34, name: 'Kon Tum' },
      { id: 35, name: 'Lai Châu' },
      { id: 36, name: 'Lâm Đồng' },
      { id: 37, name: 'Lạng Sơn' },
      { id: 38, name: 'Lào Cai' },
      { id: 39, name: 'Long An' },
      { id: 40, name: 'Nam Định' },
      { id: 41, name: 'Nghệ An' },
      { id: 42, name: 'Ninh Bình' },
      { id: 43, name: 'Ninh Thuận' },
      { id: 44, name: 'Phú Thọ' },
      { id: 45, name: 'Phú Yên' },
      { id: 46, name: 'Quảng Bình' },
      { id: 47, name: 'Quảng Nam' },
      { id: 48, name: 'Quảng Ngãi' },
      { id: 49, name: 'Quảng Ninh' },
      { id: 50, name: 'Quảng Trị' },
      { id: 51, name: 'Sóc Trăng' },
      { id: 52, name: 'Sơn La' },
      { id: 53, name: 'Tây Ninh' },
      { id: 54, name: 'Thái Bình' },
      { id: 55, name: 'Thái Nguyên' },
      { id: 56, name: 'Thanh Hóa' },
      { id: 57, name: 'Thừa Thiên Huế' },
      { id: 58, name: 'Tiền Giang' },
      { id: 59, name: 'Trà Vinh' },
      { id: 60, name: 'Tuyên Quang' },
      { id: 61, name: 'Vĩnh Long' },
      { id: 62, name: 'Vĩnh Phúc' },
      { id: 63, name: 'Yên Bái' }
    ];
    console.log('Sử dụng dữ liệu tỉnh thành cứng thay vì API');
    return of(mockProvinces);
  }

  // Lấy tất cả rạp từ API
  getAllCinemas(page: number = 1, pageSize: number = 1000): Observable<Cinema[]> {
    return this.http.get<CinemaApiResponse>(`${this.apiUrl}/Cinemas/GetListCinemas?currentPage=${page}&recordPerPage=${pageSize}`)
      .pipe(
        tap(response => console.log('API response raw:', response)),
        map(response => {
          if (response.responseCode === 200 && response.data) {
            return response.data.map(cinema => ({
              id: cinema.cinemasId,
              name: cinema.name,
              address: cinema.address,
              phoneNumber: cinema.phoneNumber,
              totalRooms: cinema.totalRooms,
              status: cinema.status
            }));
          }
          console.log('Không có dữ liệu từ API');
          return [];
        }),
        catchError(error => {
          console.error('Lỗi khi lấy danh sách rạp', error);
          return of([]);
        })
      );
  }

  // Lấy rạp theo tỉnh
  getCinemasByProvince(provinceId: number): Observable<Cinema[]> {
    // Trước tiên lấy thông tin tỉnh
    return this.getProvinces().pipe(
      map(provinces => {
        const province = provinces.find(p => p.id === provinceId);
        if (!province) {
          throw new Error('Không tìm thấy tỉnh/thành phố');
        }
        return province;
      }),
      // Sau đó lấy tất cả rạp
      switchMap(province => this.getAllCinemas().pipe(
        map(cinemas => this.simpleCinemaFilter(cinemas, province.name))
      )),
      catchError(error => {
        console.error('Lỗi khi lọc rạp theo tỉnh thành', error);
        return of([]);
      })
    );
  }

  /**
   * Phương thức lọc rạp đơn giản nhất dựa trên tên tỉnh
   */
  private simpleCinemaFilter(cinemas: Cinema[], provinceName: string): Cinema[] {
    console.log(`Lọc rạp cho tỉnh: ${provinceName}`);
    console.log(`Tổng số rạp: ${cinemas.length}`);
    
    // In danh sách tất cả rạp để kiểm tra
    cinemas.forEach((cinema, index) => {
      console.log(`Cinema ${index}: ${cinema.name}, Address: ${cinema.address}`);
    });

    // Chuẩn hóa tên tỉnh/thành phố
    let mainProvinceName = this.normalizeString(provinceName);
    
    // Loại bỏ tiền tố như "Thành phố", "Tỉnh", "Thị xã"
    if (mainProvinceName.startsWith('thanh pho ')) {
      mainProvinceName = mainProvinceName.replace('thanh pho ', '');
    } else if (mainProvinceName.startsWith('tinh ')) {
      mainProvinceName = mainProvinceName.replace('tinh ', '');
    } else if (mainProvinceName.startsWith('thi xa ')) {
      mainProvinceName = mainProvinceName.replace('thi xa ', '');
    }
    
    console.log(`Tên tỉnh đã chuẩn hóa: ${this.normalizeString(provinceName)}`);
    console.log(`Tên chính của tỉnh sau khi xử lý: ${mainProvinceName}`);
    
    // Danh sách các trường hợp đặc biệt (tên tỉnh có thể viết khác nhau)
    const specialCases: {[key: string]: string[]} = {
      'ha noi': ['ha noi', 'hanoi'],
      'ho chi minh': ['ho chi minh', 'hcm', 'tp hcm', 'tphcm', 'thanh pho ho chi minh'],
      'bac kan': ['bac kan', 'bac can', 'backan'],
      'cao bang': ['cao bang', 'caobang'],
      'ha giang': ['ha giang', 'hagiang'],
      'tuyen quang': ['tuyen quang', 'tuyenquang'],
      'lai chau': ['lai chau', 'laichau'],
      'lao cai': ['lao cai', 'laocai'],
      'dien bien': ['dien bien', 'dienbien'],
      'yen bai': ['yen bai', 'yenbai'],
      'hoa binh': ['hoa binh', 'hoabinh'],
      'thai nguyen': ['thai nguyen', 'thainguyen'],
      'lang son': ['lang son', 'langson'],
      'quang ninh': ['quang ninh', 'quangninh'],
      'phu tho': ['phu tho', 'phutho'],
      'vinh phuc': ['vinh phuc', 'vinhphuc'],
      'bac giang': ['bac giang', 'bacgiang'],
      'bac ninh': ['bac ninh', 'bacninh'],
      'hai duong': ['hai duong', 'haiduong'],
      'hai phong': ['hai phong', 'haiphong'],
      'hung yen': ['hung yen', 'hungyen'],
      'thai binh': ['thai binh', 'thaibinh'],
      'ha nam': ['ha nam', 'hanam'],
      'nam dinh': ['nam dinh', 'namdinh'],
      'ninh binh': ['ninh binh', 'ninhbinh'],
      'thanh hoa': ['thanh hoa', 'thanhhoa'],
      'nghe an': ['nghe an', 'nghean'],
      'ha tinh': ['ha tinh', 'hatinh'],
      'quang binh': ['quang binh', 'quangbinh'],
      'quang tri': ['quang tri', 'quangtri'],
      'thua thien hue': ['thua thien hue', 'hue', 'tthue'],
      'da nang': ['da nang', 'danang'],
      'quang nam': ['quang nam', 'quangnam'],
      'quang ngai': ['quang ngai', 'quangngai'],
      'binh dinh': ['binh dinh', 'binhdinh'],
      'phu yen': ['phu yen', 'phuyen'],
      'khanh hoa': ['khanh hoa', 'nha trang', 'khanhhoa'],
      'ninh thuan': ['ninh thuan', 'ninhthuan'],
      'binh thuan': ['binh thuan', 'binhthuan'],
      'kon tum': ['kon tum', 'kontum'],
      'gia lai': ['gia lai', 'gialai'],
      'dak lak': ['dak lak', 'daklak', 'dak lak'],
      'dak nong': ['dak nong', 'daknong'],
      'lam dong': ['lam dong', 'lamdong', 'da lat', 'dalat'],
      'binh phuoc': ['binh phuoc', 'binhphuoc'],
      'tay ninh': ['tay ninh', 'tayninh'],
      'binh duong': ['binh duong', 'binhduong'],
      'dong nai': ['dong nai', 'dongnai'],
      'ba ria vung tau': ['ba ria vung tau', 'vung tau', 'baria vungtau'],
      'long an': ['long an', 'longan'],
      'tien giang': ['tien giang', 'tiengiang'],
      'ben tre': ['ben tre', 'bentre'],
      'tra vinh': ['tra vinh', 'travinh'],
      'vinh long': ['vinh long', 'vinhlong'],
      'dong thap': ['dong thap', 'dongthap'],
      'an giang': ['an giang', 'angiang'],
      'kien giang': ['kien giang', 'kiengiang', 'phu quoc'],
      'can tho': ['can tho', 'cantho'],
      'hau giang': ['hau giang', 'haugiang'],
      'soc trang': ['soc trang', 'soctrang'],
      'bac lieu': ['bac lieu', 'baclieu'],
      'ca mau': ['ca mau', 'camau']
    };
    
    // Danh sách từ khóa tìm kiếm
    let searchTerms: string[] = [mainProvinceName];
    if (specialCases[mainProvinceName]) {
      searchTerms = specialCases[mainProvinceName];
      console.log(`Sử dụng các từ khóa đặc biệt cho tỉnh ${mainProvinceName}:`, searchTerms);
    }

    // Lọc rạp dựa trên danh sách từ khóa
    let result = cinemas.filter(cinema => {
      const address = this.normalizeString(cinema.address || '');
      const name = this.normalizeString(cinema.name || '');
      
      // Kiểm tra xem địa chỉ hoặc tên có chứa bất kỳ từ khóa nào
      const isMatchingProvince = searchTerms.some(term => 
        address.includes(term) || name.includes(term)
      );
      
      console.log(`Kiểm tra "${cinema.name}" (địa chỉ: "${cinema.address}") có thuộc tỉnh "${mainProvinceName}" không: ${isMatchingProvince}`);
      
      return isMatchingProvince;
    });

    console.log(`Tìm thấy ${result.length} rạp cho tỉnh ${provinceName}`);
    if (result.length > 0) {
      console.log("Rạp đầu tiên:", result[0].name, result[0].address);
    }

    return result;
  }

  private normalizeString(str: string): string {
    if (!str) return '';
    return str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu
      .replace(/\s+/g, ' ') // Chuẩn hóa khoảng trắng
      .trim(); // Loại bỏ khoảng trắng thừa ở đầu và cuối
  }
}
