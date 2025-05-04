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

  login(userName: string, passWord: string,cinemaId : string): Observable<User> {
    const loginData: LoginRequest = { userName, passWord, cinemaId };
    return this.http.post<any>(`${this.API_URL}/Account/LoginByEmployee`, loginData)}

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