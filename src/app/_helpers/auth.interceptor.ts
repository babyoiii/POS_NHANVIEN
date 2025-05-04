import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService, private router: Router) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Lấy token từ AuthService
    const token = this.authService.getToken();
    
    // Nếu có token, thêm vào header của request
    if (token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Xử lý lỗi 401 Unauthorized - token hết hạn hoặc không hợp lệ
        if (error.status === 401) {
          // Kiểm tra nếu request không liên quan đến quét mã QR 
          // (các request đến endpoint QRScanner sẽ được xử lý riêng trong component)
          if (!request.url.includes('/api/Counter/QRScanner')) {
            this.authService.logout().subscribe(() => {
              this.router.navigate(['/login']);
            });
          } else {
            console.log('Bỏ qua chuyển hướng đăng nhập cho request quét mã QR:', request.url);
          }
        }
        return throwError(() => error);
      })
    );
  }
} 