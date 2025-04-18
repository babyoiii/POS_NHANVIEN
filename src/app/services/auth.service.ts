//auth.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { User } from '../models/cinema.model';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Fake data cho tài khoản đăng nhập
  private users: { email: string; password: string; user: User }[] = [
    { 
      email: 'staff@cinex.com', 
      password: 'staff123', 
      user: { 
        id: 1, 
        email: 'staff@cinex.com', 
        name: 'Nguyễn Văn A', 
        role: 'staff' 
      } 
    },
    { 
      email: 'manager@cinex.com', 
      password: 'manager123', 
      user: { 
        id: 2, 
        email: 'manager@cinex.com', 
        name: 'Trần Thị B', 
        role: 'manager' 
      } 
    }
  ];

  private currentUser: User | null = null;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    // Khôi phục user từ localStorage nếu đang ở môi trường browser
    this.getCurrentUser();
  }

  login(email: string, password: string): Observable<User> {
    const foundUser = this.users.find(u => u.email === email && u.password === password);
    
    if (foundUser) {
      this.currentUser = foundUser.user;
      if (this.isBrowser) {
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      }
      return of(foundUser.user);
    } else {
      return throwError(() => new Error('Tài khoản hoặc mật khẩu không chính xác'));
    }
  }

  logout(): Observable<boolean> {
    this.currentUser = null;
    if (this.isBrowser) {
    localStorage.removeItem('currentUser');
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
}
