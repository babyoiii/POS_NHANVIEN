import { Routes } from '@angular/router';
import { LoginComponent } from './Component/login/login.component';
import { MainComponent } from './Layout/main/main.component';
import { TicketComponent } from './Component/ticket/ticket.component';
import { PhimDangChieuComponent } from './Component/ticket/phim-dang-chieu/phim-dang-chieu.component';
import { PhimSapChieuComponent } from './Component/ticket/phim-sap-chieu/phim-sap-chieu.component';
import { SettingComponent } from './Component/setting/setting.component';
import { BongNuocComponent } from './Component/bong-nuoc/bong-nuoc.component';
import { QRcodeComponent } from './Component/qrcode/qrcode.component';
import { QrPaymentComponent } from './qr-payment/qr-payment.component';
import { QrPaymentTestComponent } from './qr-payment-test/qr-payment-test.component';
import { AuthGuard } from './guards/auth.guard';
import { SeatMapComponent } from './Component/ticket/seat-map/seat-map.component';
import { FoodSelectionComponent } from './Component/ticket/food-selection/food-selection.component';
import { RefundTicketComponent } from './Component/refund-ticket/refund-ticket.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  // Thêm các routes khác ở đây
  {
    path: 'trangchu',
    component: MainComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'ticket', component: TicketComponent, children: [
          { path: 'now', component: PhimDangChieuComponent },
          { path: 'coming', component: PhimSapChieuComponent },
          { path: '', redirectTo: 'now', pathMatch: 'full' }
        ]
      },
      { path: 'seat-map/:showtimeId', component: SeatMapComponent },
      { path: 'ticket/food/:showtimeId', component: FoodSelectionComponent },
      { path: '', redirectTo: 'ticket', pathMatch: 'full' },
      { 
        path: 'caidat', 
        component: SettingComponent,
        canActivate: [AuthGuard],
        data: { permission: 'caidat' }
      },
      { path: 'doan', component: BongNuocComponent },
      { path: 'refund-ticket', component: RefundTicketComponent },
    ]
  },
  {
    path: 'qr',
    component: QRcodeComponent,
    data: { ssr: false }  // Vô hiệu hóa SSR cho trang QR scanner
  },
  {
    path: 'qr-payment',
    component: QrPaymentComponent,
    data: { ssr: false }
  },
  {
    path: 'qr-payment-test',
    component: QrPaymentTestComponent,
    data: { ssr: false }
  },

];
