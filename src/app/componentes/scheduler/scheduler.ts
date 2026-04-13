
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VerHorarios } from './ver-horarios/ver-horarios';
import { RouterModule } from '@angular/router';


@Component({
  selector: 'app-scheduler',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './scheduler.html',
  styleUrls: ['./scheduler.scss']
})
export class SchedulerComponent {
  loading = false;
  message = '';
  isSuccess = false;
  usuarioNombre: string = '';
  usuarioCarrera: string = '';
  groupedSchedules: Array<{ nombregrupo: string; data: any[] }> = [];
  diasSemana: string[] = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
  horas: string[] = ['17', '18', '19', '20', '21'];
  vistaHorarios: 'grupo' | 'profesor' = 'grupo';
  profesoresConHorarios: Array<{ nombre: string, clases: any[] }> = [];

  getClase(data: any[], dia: string, hora: string): any {
    // Busca la clase cuyo campo start coincide con el día y la hora
    return data.find(clase => {
      if (typeof clase.start === 'string') {
        return clase.start.startsWith(dia) && clase.start.substring(3, 5) === hora;
      }
      return false;
    }) || null;
  }


  getClaseProfesor(clases: any[], dia: string, hora: string): any {
    return clases.find(clase => {
      if (typeof clase.start === 'string') {
        return clase.start.startsWith(dia) && clase.start.substring(3, 5) === hora;
      }
      return false;
    }) || null;
  }

  ngOnInit() {
    const usuarioData = localStorage.getItem('userData');
    if (usuarioData) {
      const { full_name, metadata: { division, turno } } = JSON.parse(usuarioData);
      this.usuarioNombre = full_name || 'Usuario';
      this.usuarioCarrera = `${division || ''} - ${turno || ''}`;

    } else {
      this.usuarioNombre = 'Usuario';
      this.usuarioCarrera = '';
    }
    this.cargarHorariosCreados();
  }

  async cargarHorariosCreados() {
    try {
      const res = await fetch('https://horarios-backend-58w8.onrender.com/scheduler/allschedules');
      if (!res.ok) throw new Error('Error al obtener horarios creados');
      const data = await res.json();
      console.log('Horarios creados:', data);
      // El backend puede devolver { schedules: [...] } o directamente un array
      const schedulesArray = Array.isArray(data) ? data : (data?.schedules ?? []);
      if (Array.isArray(schedulesArray)) {
        this.groupedSchedules = schedulesArray.map((s: any) => ({
          nombregrupo: s.nombregrupo ?? s.groupName ?? 'Sin nombre',
          data: Array.isArray(s.data) ? s.data : []
        }));
        // Generar lista de profesores con sus clases
        const clasesTodas: any[] = schedulesArray.flatMap((g: any) => Array.isArray(g.data) ? g.data : []);
        const profesoresMap: { [nombre: string]: any[] } = {};
        for (const clase of clasesTodas) {
          if (clase.prof) {
            if (!profesoresMap[clase.prof]) profesoresMap[clase.prof] = [];
            profesoresMap[clase.prof].push(clase);
          }
        }
        this.profesoresConHorarios = Object.entries(profesoresMap).map(([nombre, clases]) => ({ nombre, clases }));
      } else {
        this.groupedSchedules = [];
        this.profesoresConHorarios = [];
      }


    } catch (err) {
      alert('No se pudo cargar la lista de horarios creados: ' + err);
    }
  }

  generateSchedule() {
    this.loading = true;
    this.message = '';
    this.isSuccess = false;

    fetch('https://horarios-backend-58w8.onrender.com/scheduler/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
      .then(async res => {
        if (!res.ok) throw new Error('Error al generar los horarios');
        const response = await res.json();
        this.loading = false;
        this.isSuccess = true;
        this.message = '✅ Horarios generados correctamente.';
        console.log('Respuesta del backend:', response);
      })
      .catch(error => {
        this.loading = false;
        this.isSuccess = false;
        this.message = '❌ Ocurrió un error al generar los horarios.';
        console.error('Error:', error);
      });
  }




  exportarPDF(group: { nombregrupo: string; data: any[] }) {
    const doc = new jsPDF();

    // Colores institucionales
    const primaryColor = [0, 91, 170] as [number, number, number]; // #005baa
    const secondaryColor = [245, 247, 250] as [number, number, number]; // #f5f7fa

    // Encabezado del documento
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 20, 'F');

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(`Horario de Grupo`, 14, 13);

    doc.setFontSize(10);
    doc.text(`Sistema de Horarios`, 180, 13, { align: 'right' });

    // Información del grupo
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grupo: ${group.nombregrupo}`, 14, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 14, 36);

    const head = [['Hora', ...this.diasSemana]];
    const body: any[] = [];

    for (const hora of this.horas) {
      const row: any[] = [hora + ':00'];
      for (const dia of this.diasSemana) {
        const clase = this.getClase(group.data, dia, hora);
        if (clase) {
          row.push([
            clase.subj,
            clase.prof || 'Sin profesor',
            clase.room || 'Sin salón'
          ].filter(Boolean).join('\n'));
        } else {
          row.push('');
        }
      }
      body.push(row);
    }

    autoTable(doc, {
      head,
      body,
      startY: 45,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: 'middle',
        halign: 'center',
        lineColor: [224, 228, 234],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
    });

    // Pie de página
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Documento generado automáticamente por el sistema de horarios escolar', 105, 290, { align: 'center' });
    }

    doc.save(`horario_${group.nombregrupo}.pdf`);
  }


  // ...mantener el resto del código igual...

  exportarPDFProfesor(prof: { nombre: string, clases: any[] }) {
    const doc = new jsPDF();

    // Colores institucionales
    const primaryColor = [0, 91, 170] as [number, number, number];
    const secondaryColor = [245, 247, 250] as [number, number, number];

    // Encabezado
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 20, 'F');

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(`Horario de Profesor`, 14, 13);

    doc.setFontSize(10);
    doc.text(`Sistema de Horarios`, 180, 13, { align: 'right' });

    // Información del profesor
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Profesor: ${prof.nombre}`, 14, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 14, 36);

    const head = [['Hora', ...this.diasSemana]];
    const body: any[] = [];

    for (const hora of this.horas) {
      const row: any[] = [hora + ':00'];
      for (const dia of this.diasSemana) {
        const clase = this.getClaseProfesor(prof.clases, dia, hora);
        if (clase) {
          row.push([
            clase.subj,
            `Grupo: ${clase.group || clase.grupo || '-'}`,
            clase.room
          ].filter(Boolean).join('\n'));
        } else {
          row.push('');
        }
      }
      body.push(row);
    }

    autoTable(doc, {
      head,
      body,
      startY: 45,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: 'middle',
        halign: 'center',
        lineColor: [224, 228, 234],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 20, fillColor: secondaryColor },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 0 && data.cell.raw) {
          data.cell.styles.fillColor = [234, 243, 251];
          data.cell.styles.textColor = [0, 91, 170];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // Pie de página
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Documento generado automáticamente por el sistema de horarios escolar', 105, 290, { align: 'center' });
    }

    doc.save(`horario_profesor_${prof.nombre}.pdf`);
  }
}
