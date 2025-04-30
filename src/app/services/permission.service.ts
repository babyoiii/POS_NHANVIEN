import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class PermissionService {
    // Định nghĩa các quyền và vai trò tương ứng
    private readonly ROLE_PERMISSIONS: { [key: string]: string[] } = {
        'Admin': ['admin', 'manager', 'staff', 'thongke', 'caidat'], // Admin có tất cả quyền
        'Employee': ['staff'] // Nhân viên chỉ có quyền cơ bản
        };

    constructor(private authService: AuthService) { }

    /**
     * Kiểm tra người dùng có quyền cụ thể không
     * @param permission Tên quyền cần kiểm tra
     * @returns true nếu có quyền, false nếu không
     */
    hasPermission(permission: string): boolean {
        const user = this.authService.getCurrentUser();
        if (!user || !user.roles || user.roles.length === 0) {
            return false;
        }

        // Kiểm tra từng vai trò của người dùng
        for (const role of user.roles) {
            const permissions = this.ROLE_PERMISSIONS[role];
            if (permissions && permissions.includes(permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Lấy danh sách quyền của người dùng hiện tại
     * @returns Danh sách quyền
     */
    getUserPermissions(): string[] {
        const user = this.authService.getCurrentUser();
        if (!user || !user.roles || user.roles.length === 0) {
            return [];
        }

        // Tập hợp tất cả quyền từ các vai trò của người dùng
        const permissions = new Set<string>();
        for (const role of user.roles) {
            const rolePermissions = this.ROLE_PERMISSIONS[role];
            if (rolePermissions) {
                rolePermissions.forEach(perm => permissions.add(perm));
            }
        }

        return Array.from(permissions);
    }
} 