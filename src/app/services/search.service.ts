import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Movie } from './movie.service';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private searchQuerySubject = new BehaviorSubject<string>('');
  searchQuery$: Observable<string> = this.searchQuerySubject.asObservable();

  constructor() { }

  updateSearchQuery(query: string): void {
    this.searchQuerySubject.next(query);
  }

  filterMovies(movies: Movie[], searchTerm: string): Movie[] {
    if (!searchTerm || searchTerm.trim() === '') {
      return movies;
    }

    searchTerm = searchTerm.toLowerCase().trim();

    return movies.filter(movie => {
      // Search by movie name
      const matchesName = movie.movieName.toLowerCase().includes(searchTerm);
      
      // Search by genre
      const matchesGenre = movie.genres.some(genre => 
        genre.genreName.toLowerCase().includes(searchTerm)
      );
      
      return matchesName || matchesGenre;
    });
  }
} 