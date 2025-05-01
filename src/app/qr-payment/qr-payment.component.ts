import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-qr-payment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-payment.component.html',
  styleUrl: './qr-payment.component.css'
})
export class QrPaymentComponent implements OnInit {
  qrImageUrl: string = '';
  amount: number = 0;
  orderId: string = '';
  paymentCode: string = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Get query parameters from URL
    this.route.queryParams.subscribe(params => {
      if (params['qrUrl']) {
        this.qrImageUrl = decodeURIComponent(params['qrUrl']);
      }
      if (params['amount']) {
        this.amount = +params['amount'];
      }
      if (params['orderId']) {
        this.orderId = params['orderId'];
      }
      if (params['paymentCode']) {
        this.paymentCode = params['paymentCode'];
      }
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  closeWindow(): void {
    window.close();
  }
}
