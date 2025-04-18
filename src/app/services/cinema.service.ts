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
    return this.http.get<any[]>(`${this.provincesApiUrl}p/`)
      .pipe(
        map(response => response.map(item => ({ id: item.code, name: item.name }))),
        catchError(error => {
          console.error('Lỗi khi lấy danh sách tỉnh thành', error);
          return of([]);
        })
      );
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
