import { Component } from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule,RouterLink,RouterOutlet],
  templateUrl: './ticket.component.html',
  styleUrl: './ticket.component.css'
})
export class TicketComponent {
  currentComponent: string = 'now';
  
   isActive(tabName: string): boolean {
    return this.currentComponent === tabName;
  }
}
