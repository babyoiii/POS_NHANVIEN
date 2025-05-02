import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// Define the Service interface locally for type safety
interface Service {
  id: string;
  serviceTypeID: string;
  imageUrl: string;
  serviceName: string;
  description: string;
  price: number;
  status: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConcessionSearchService {
  private searchQuerySubject = new BehaviorSubject<string>('');
  searchQuery$: Observable<string> = this.searchQuerySubject.asObservable();

  constructor() { }

  updateSearchQuery(query: string): void {
    this.searchQuerySubject.next(query);
  }

  filterConcessions(concessions: Service[], searchTerm: string): Service[] {
    if (!searchTerm || searchTerm.trim() === '') {
      return concessions;
    }

    searchTerm = searchTerm.toLowerCase().trim();

    return concessions.filter(concession => {
      // Search by name
      const matchesName = concession.serviceName.toLowerCase().includes(searchTerm);
      
      // Search by description
      const matchesDescription = concession.description?.toLowerCase().includes(searchTerm);
      
      return matchesName || matchesDescription;
    });
  }
} 