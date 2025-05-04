import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ServiceApiService {
  private apiUrl = 'https://localhost:7263';

  constructor(private http: HttpClient) { }

  // API bán nhanh dịch vụ - dùng cho thanh toán tiền mặt tại quầy
  quickServiceSale(serviceListJson: string, userId: string, customerEmail?: string): Observable<any> {
    const request = {
      serviceListJson,
      userId,
      customerEmail,
      markAsUsed: true
    };
    return this.http.post(`${this.apiUrl}/api/Counter/Service/QuickSale`, request);
  }

  // API tạo đơn hàng dịch vụ - dùng cho thanh toán QR
  createServiceOrder(serviceListJson: string, email?: string): Observable<any> {
    const request = {
      serviceListJson,
      email,
      isAnonymous: true
    };
    
    // Lưu một bản sao của dữ liệu dịch vụ vào localStorage để truy xuất khi cần thiết
    try {
      localStorage.setItem('current_service_data', serviceListJson);
      localStorage.setItem('current_service_email', email || '');
      localStorage.setItem('service_timestamp', Date.now().toString());
      console.log('Đã lưu dữ liệu dịch vụ vào localStorage');
    } catch (e) {
      console.error('Lỗi khi lưu dữ liệu dịch vụ vào localStorage:', e);
    }
    
    return this.http.post(`${this.apiUrl}/api/Counter/Service/ManageOrder?action=1`, request);
  }

  // API xác nhận thanh toán
  confirmServicePayment(orderCode: string, userId: string): Observable<any> {
    console.log(`Gọi API xác nhận thanh toán với orderCode: "${orderCode}", userId: "${userId}"`);

    // Kiểm tra orderCode có hợp lệ không
    if (!orderCode || orderCode.trim() === '') {
      console.error('Lỗi: orderCode không hợp lệ trong confirmServicePayment');
      throw new Error('Mã đơn hàng không hợp lệ');
    }

    // Đảm bảo orderCode được truyền đúng cách trong URL và body
    const url = `${this.apiUrl}/api/Counter/Service/ManageOrder?action=2&orderCode=${encodeURIComponent(orderCode)}`;
    const body = {
      userId,
      orderCode // Thêm orderCode vào body để đảm bảo API nhận được
    };

    console.log('URL API xác nhận thanh toán:', url);
    console.log('Body gửi đi:', body);

    return this.http.post(url, body);
  }

  // API kiểm tra trạng thái đơn hàng
  getOrderStatus(orderCode: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/Counter/Service/GetOrderInfo?orderCode=${orderCode}`);
  }
} 
