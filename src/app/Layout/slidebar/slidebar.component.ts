import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-slidebar',
  standalone: true,
  imports: [RouterLink,CommonModule],
  templateUrl: './slidebar.component.html',
  styleUrl: './slidebar.component.css'
})
export class SlidebarComponent {
   // Phương thức mở QR code trong tab mới
  openQRCodeInNewTab() {
    window.open('/qr', '_blank');
  }
}
