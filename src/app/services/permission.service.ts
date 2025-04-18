import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class PermissionService {
    private permissions: {
        [role: string]: {
            [permission: string]: boolean
        }
    } = {
            staff: {
                'thongke': false,  // Nhân viên không có quyền xem thống kê
                'caidat': false    // Nhân viên không có quyền cài đặt
            },
            manager: {
                'thongke': true,   // Manager có quyền xem thống kê
                'caidat': true     // Manager có quyền cài đặt
            }
        };

    constructor(private authService: AuthService) { }

    hasPermission(permission: string): boolean {
        const user = this.authService.getCurrentUser();
        if (!user) return false;

        // Nếu permission không được định nghĩa cho role này, mặc định là true
        return this.permissions[user.role]?.[permission] !== false;
    }
} 