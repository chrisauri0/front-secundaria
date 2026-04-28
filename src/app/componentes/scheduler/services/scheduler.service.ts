import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SchedulerService {
  private apiUrl = `${environment.apiBaseUrl}/scheduler`;
  private cacheKey = 'horariosCache';


  async getHorarios(): Promise<any[]> {
    const cached = localStorage.getItem(this.cacheKey);
    if (cached) {
      console.log('ðŸ—ƒï¸ Cargando horarios desde cache');
      return JSON.parse(cached);
    }

    try {
      const res = await fetch(`${this.apiUrl}/allschedules`);
      if (!res.ok) throw new Error('Error al obtener horarios');
      const data = await res.json();
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
      return data;
    } catch (err) {
      console.error('Error al obtener horarios:', err);
      return [];
    }
  }

  clearCache() {
    localStorage.removeItem(this.cacheKey);
  }
}

