import { Routes } from '@angular/router';
import { LoginComponent } from './Component/login/login.component';
import { MainComponent } from './Layout/main/main.component';
import { TicketComponent } from './Component/ticket/ticket.component';
import { PhimDangChieuComponent } from './Component/ticket/phim-dang-chieu/phim-dang-chieu.component';
import { PhimSapChieuComponent } from './Component/ticket/phim-sap-chieu/phim-sap-chieu.component';
import { KhuyenMaiComponent } from './Component/ticket/khuyen-mai/khuyen-mai.component';
import { VeDaDatComponent } from './Component/ve-da-dat/ve-da-dat.component';
import { SettingComponent } from './Component/setting/setting.component';
import { ThongKeComponent } from './Component/thong-ke/thong-ke.component';
import { BongNuocComponent } from './Component/bong-nuoc/bong-nuoc.component';
import { QRcodeComponent } from './Component/qrcode/qrcode.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  // Thêm các routes khác ở đây
  {
    path: 'trangchu', component: MainComponent, children: [
      {
        path: 'ticket', component: TicketComponent, children: [
          { path: 'now', component: PhimDangChieuComponent },
          { path: 'coming', component: PhimSapChieuComponent },
          { path: 'sale', component: KhuyenMaiComponent },
          { path: '', redirectTo: 'now', pathMatch: 'full' }
        ]
      },
      { path: '', redirectTo: 'ticket', pathMatch: 'full' },
      { path: 'vedadat', component: VeDaDatComponent },
      { path: 'caidat', component: SettingComponent },
      { path: 'thongke', component: ThongKeComponent },
      { path: 'doan', component: BongNuocComponent },
      
    ]
  },
  { path: 'qr', component: QRcodeComponent },
];
