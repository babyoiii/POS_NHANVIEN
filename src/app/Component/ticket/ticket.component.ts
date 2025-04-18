import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './ticket.component.html',
  styleUrl: './ticket.component.css'
})
export class TicketComponent implements OnInit {
  currentComponent: string = 'now';
  
  constructor(private router: Router) {
    // Theo dõi sự thay đổi route để cập nhật currentComponent
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects || event.url;
      // Lấy phần path cuối cùng của URL
      const segments = url.split('/');
      const lastSegment = segments[segments.length - 1];
      
      // Cập nhật tab active dựa trên route
      if (['now', 'coming', 'sale'].includes(lastSegment)) {
        this.currentComponent = lastSegment;
      } else {
        // Mặc định là "now" nếu không khớp
        this.currentComponent = 'now';
      }
    });
  }
  
  ngOnInit(): void {
    // Khởi tạo currentComponent ban đầu
    const currentUrl = this.router.url;
    const segments = currentUrl.split('/');
    const lastSegment = segments[segments.length - 1];
    
    if (['now', 'coming', 'sale'].includes(lastSegment)) {
      this.currentComponent = lastSegment;
    } else {
      // Mặc định là "now" nếu không khớp
      this.currentComponent = 'now';
    }
  }

  isActive(tabName: string): boolean {
    return this.currentComponent === tabName;
  }
}
