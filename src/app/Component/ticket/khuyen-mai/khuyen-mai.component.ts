import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-khuyen-mai',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './khuyen-mai.component.html',
  styleUrl: './khuyen-mai.component.css'
})
export class KhuyenMaiComponent {
  activeFilter: string = 'all';

  setActiveFilter(filter: string): void {
    this.activeFilter = filter;
    console.log('Filter set to:', filter);
  }

  isActive(filter: string): boolean {
    return this.activeFilter === filter;
  }
}
