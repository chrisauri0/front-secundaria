import { Component, NgModule } from '@angular/core';
import jsPDF from 'jspdf';

import autoTable from 'jspdf-autotable';
import { SchedulerService } from '../services/scheduler.service';
import { FormsModule, NgModel } from '@angular/forms';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-ver-horarios',
  imports: [FormsModule, CommonModule],
  templateUrl: './ver-horarios.html',
  styleUrl: './ver-horarios.scss'
})
export class VerHorarios {
  diasSemana: string[] = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
  horas: string[] = [
     '01', '02', '03', '04', '05', '06'
  ];
  bloquesLabel: Record<string, string> = {
    '01': '07:00-07:50',
    '02': '07:50-08:40',
    '03': '08:40-09:30',
    '04': '09:50-10:40',
    '05': '10:40-11:30',
    '06': '11:30-12:20',
  };

 
 horarios: any[] = [];
  selectedGroup: string = '';
  grupos: string[] = [];

  constructor(private schedulerService: SchedulerService) {}

  async ngOnInit(): Promise<void> {
    const data = await this.schedulerService.getHorarios();
    let horariosArr: any[] = [];
    if (Array.isArray(data)) {
      horariosArr = data;
    } else if (data && Array.isArray((data as any).schedules)) {
      horariosArr = (data as any).schedules;
    }
    this.horarios = horariosArr;
    this.grupos = horariosArr.map(h => h.nombregrupo);
    this.selectedGroup = this.grupos[0] ?? '';
    console.log('Horarios cargados:', this.horarios);
    console.log('Grupos:', this.grupos);
  }

  getHorariosPorGrupo(): any[] {
    if (!Array.isArray(this.horarios)) return [];
    const grupo = this.horarios.find(h => h.nombregrupo === this.selectedGroup);
    const result = grupo && Array.isArray(grupo.data) ? grupo.data : [];
    console.log('Clases para grupo', this.selectedGroup, ':', result);
    return result;
  }

  getHorarioGrid(): {[hora: string]: {[dia: string]: any}} {
    const grid: {[hora: string]: {[dia: string]: any}} = {};
    for (const hora of this.horas) {
      grid[hora] = {};
      for (const dia of this.diasSemana) {
        grid[hora][dia] = null;
      }
    }
    const clases = this.getHorariosPorGrupo();
    console.log('Clases para grid:', clases);
    for (const clase of clases) {
      // start: 'Mar18' => dia: 'Mar', hora: '18'
      if (typeof clase.start === 'string' && clase.start.length >= 5) {
        const dia = clase.start.substring(0, 3); // 'Mar'
        const hora = clase.start.substring(3, 5); // '18'
        console.log('Clase:', clase, 'Dia:', dia, 'Hora:', hora);
        if (grid[hora] && grid[hora][dia] !== undefined) {
          grid[hora][dia] = clase;
        }
      }
    }
    console.log('Grid generado:', grid);
    return grid;
  }

  exportarPDF() {
    const doc = new jsPDF();
    // Encabezado: Hora, luego días
    const head = [['Hora', ...this.diasSemana]];
    const grid = this.getHorarioGrid();
    const body: any[] = [];
    for (const hora of this.horas) {
      const row: any[] = [this.bloquesLabel[hora] || hora];
      for (const dia of this.diasSemana) {
        const clase = grid[hora][dia];
        if (clase) {
          // Mostrar materia, profesor y salón en líneas separadas
          row.push(
            `${clase.subj || ''}\n${clase.prof || ''}\n${clase.room || ''}`
          );
        } else {
          row.push('');
        }
      }
      body.push(row);
      if (hora === '03') {
        body.push(['RECESO', '09:30-09:50', '09:30-09:50', '09:30-09:50', '09:30-09:50', '09:30-09:50']);
      }
    }
    autoTable(doc, {
      head,
      body,
      styles: {
        cellPadding: 2,
        fontSize: 9,
        valign: 'middle',
        halign: 'center',
      },
      headStyles: {
        fillColor: [14, 23, 42],
        textColor: [56, 189, 248],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [30, 41, 59],
      },
      margin: { top: 20 },
    });
    doc.save(`horario_${this.selectedGroup}.pdf`);
  }

  recargarHorarios() {
    this.schedulerService.clearCache();
    window.location.reload();
  }
}
