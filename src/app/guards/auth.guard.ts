import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';

export const AuthGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const permissionService = inject(PermissionService);
  
  const user = authService.getCurrentUser();
  
  // Kiểm tra đăng nhập
  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  // Kiểm tra quyền
  const requiredPermission = route.data['permission'] as string;
  if (requiredPermission && !permissionService.hasPermission(requiredPermission)) {
    // Chuyển hướng về trang chủ nếu không có quyền
    router.navigate(['/trangchu']);
    return false;
  }

  return true;
}; 