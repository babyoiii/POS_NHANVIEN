//auth.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { User, LoginRequest, LoginResponse } from '../models/cinema.model';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'https://localhost:7263/api';
  private currentUser: User | null = null;
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    // Khôi phục user từ localStorage nếu đang ở môi trường browser
    this.getCurrentUser();
  }

  login(userName: string, passWord: string): Observable<User> {
    const loginData: LoginRequest = { userName, passWord };
    
    console.log('Attempting login with:', loginData);
    
    return this.http.post<any>(`${this.API_URL}/Account/Login`, loginData)
      .pipe(
        tap(response => console.log('Raw API response:', response)),
        map(response => {
          console.log('Login response code:', response?.responseCode);
          console.log('Login response data:', response?.data);
          
          // Check for different response formats
          if (response && 
             (response.responseCode === 200 || response.ResponseCode === 200) && 
             (response.data || response.Data)) {
             
            const data = response.data || response.Data;
            
            // Make sure access token and roles exist
            if (!data.accessToken && !data.AccessToken) {
              console.error('Access token missing in response');
              throw new Error('Đăng nhập không thành công: thiếu token');
            }
            
            if (!data.roles && !data.Roles) {
              console.error('Roles missing in response');
              throw new Error('Đăng nhập không thành công: thiếu quyền');
            }
            
            const roles = data.roles || data.Roles || [];
            
            const userData: User = {
              id: data.userId || data.UserId,
              userName: data.userName || data.UserName,
              displayName: data.displayName || data.DisplayName,
              email: (data.email || data.Email) || undefined,
              roles: roles,
              role: roles.length > 0 ? roles[0] : '',
              accessToken: data.accessToken || data.AccessToken,
              refreshToken: data.refreshToken || data.RefreshToken
            };
            
            console.log('User data created:', userData);
            
            this.currentUser = userData;
            if (this.isBrowser) {
              localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
              if (userData.accessToken) {
                localStorage.setItem('token', userData.accessToken);
              }
              if (userData.refreshToken) {
                localStorage.setItem('refreshToken', userData.refreshToken);
              }
            }
            
            return userData;
          }
          
          console.log('Login conditions not met, throwing error');
          throw new Error('Đăng nhập không thành công');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Lỗi đăng nhập:', error);
          return throwError(() => new Error('Tài khoản hoặc mật khẩu không chính xác'));
        })
      );
  }

  logout(): Observable<boolean> {
    this.currentUser = null;
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
    return of(true);
  }

  getCurrentUser(): User | null {
    if (!this.currentUser && this.isBrowser) {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          this.currentUser = JSON.parse(storedUser);
        } catch (e) {
          console.error('Lỗi khi parse thông tin user từ localStorage:', e);
        }
      }
    }
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    return this.getCurrentUser() !== null;
  }

  getToken(): string | null {
    return this.isBrowser ? localStorage.getItem('token') : null;
  }

  getRefreshToken(): string | null {
    return this.isBrowser ? localStorage.getItem('refreshToken') : null;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.roles) return false;
    return user.roles.includes(role);
  }
}
