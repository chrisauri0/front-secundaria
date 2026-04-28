import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import resultado from './resultado.json';
import { OrderByStartPipe } from './orderPipe';
import { environment } from '../../../environments/environment';

// datos para los horarios
import { salonesData } from '../salones/salones';

@Component({
  selector: 'app-horarios',
  imports: [CommonModule, ],
  templateUrl: './horarios.html',
  styleUrls: ['./horarios.scss']
})
export class HorariosComponent {

salones: salonesData[] = [];

  resultado: any[] = resultado;

  grupos: { [key: string]: any[] } = {};

  constructor() {
    for (const item of this.resultado) {
      if (!this.grupos[item.group]) {
        this.grupos[item.group] = [];
      }
      this.grupos[item.group].push(item);
    }
  }


 async cargarSalones() {
    try {
      const res = await fetch(`${environment.apiBaseUrl}/salones`);
      if (!res.ok) throw new Error('Error al obtener salones');
      const data = await res.json();
      this.salones = Array.isArray(data) ? data.map((s, idx) => ({
        id: s.id || idx,
        nombre: s.nombre,
        edificio_id: s.edificio_id || ''
        
      })) : [];
    } catch (err) {
      alert('No se pudo cargar la lista de salones: ' + err);
    }
  }


  formatStart(start: string): string {
    // Ejemplo: "Lun17" => "Lunes 17:00"
    const dias: { [key: string]: string } = {
      Lun: 'Lunes',
      Mar: 'Martes',
      Mie: 'MiÃ©rcoles',
      Jue: 'Jueves',
      Vie: 'Viernes',
      Sab: 'SÃ¡bado'
    };
    const match = start.match(/^([A-Za-z]+)(\d{1,2})$/);
    if (match) {
      const dia = dias[match[1]] || match[1];
      const hora = match[2].padStart(2, '0') + ':00';
      return `${dia} ${hora}`;
    }
    return start;
  }

  diasSemana = ['Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes'];
horas = [ '17:00', '18:00', '19:00', '20:00', '21:00' ];

getClase(clases: any[], dia: string, hora: string) {
  // Busca la clase que corresponde al dÃ­a y hora
  return clases.find(c => this.formatStart(c.start).startsWith(dia) && this.formatStart(c.start).includes(hora));
}
}
