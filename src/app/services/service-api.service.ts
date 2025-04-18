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
    return this.http.post(`${this.apiUrl}/api/Counter/Service/ManageOrder?action=1`, request);
  }

  // API xác nhận thanh toán
  confirmServicePayment(orderCode: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/Counter/Service/ManageOrder?action=2&orderCode=${orderCode}`, { userId });
  }

  // API kiểm tra trạng thái đơn hàng
  getOrderStatus(orderCode: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/Counter/Service/GetOrderInfo?orderCode=${orderCode}`);
  }
} 