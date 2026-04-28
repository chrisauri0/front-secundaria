
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VerHorarios } from './ver-horarios/ver-horarios';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

type ScopeMode = 'todo' | 'grado' | 'grupo' | 'materia' | 'personalizado';

interface GrupoCatalogo {
  id: string;
  nombre: string;
  grado: number;
  limite_alumnos?: number;
  alumnosActuales?: number;
}

interface MateriaCatalogo {
  id: string;
  nombre: string;
  grado?: number;
  permitir_doble_bloque?: boolean;
}

interface HorarioClase {
  start: string;
  subj: string;
  prof: string;
  room: string;
  [key: string]: any;
}

interface MoveEditorState {
  groupName: string;
  clase: HorarioClase;
  toDay: string;
  toHour: string;
}

interface MissingSubjectItem {
  group: string;
  subject: string;
  missing: number;
}

interface MissingByGroup {
  group: string;
  items: string[];
}

interface FillOption {
  subject: string;
  missing: number;
}

interface FillEditorState {
  groupName: string;
  day: string;
  hour: string;
  start: string;
  selectedSubject: string;
  options: FillOption[];
}

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './scheduler.html',
  styleUrls: ['./scheduler.scss']
})
export class SchedulerComponent {
  loading = false;
  message = '';
  isSuccess = false;
  // Compat placeholders while the Angular template diagnostics refresh.
  scopeMode: ScopeMode = 'personalizado';
  gradoFiltro: string = 'all';
  grupoFiltro: string = 'all';
  materiaFiltro: string = 'all';
  generarTodo = true;
  gruposSeleccionados: string[] = [];
  materiasSeleccionadas: string[] = [];
  usuarioNombre: string = '';
  usuarioTurno: string = '';
  groupedSchedules: Array<{ nombregrupo: string; data: any[] }> = [];
  gruposDisponibles: GrupoCatalogo[] = [];
  materiasDisponibles: MateriaCatalogo[] = [];
  diasSemana: string[] = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
  horas: string[] = ['01', '02', '03', '04', '05', '06'];
  bloquesLabel: Record<string, string> = {
    '01': '07:00-07:50',
    '02': '07:50-08:40',
    '03': '08:40-09:30',
    '04': '09:50-10:40',
    '05': '10:40-11:30',
    '06': '11:30-12:20',
  };
  vistaHorarios: 'grupo' | 'profesor' = 'grupo';
  profesoresConHorarios: Array<{ nombre: string, clases: any[] }> = [];
  moveEditor: MoveEditorState | null = null;
  moving = false;
  fillEditor: FillEditorState | null = null;
  filling = false;
  warningMissingSubjects: MissingSubjectItem[] = [];
  warningMissingByGroup: MissingByGroup[] = [];

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token') || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private normalizeKey(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  get gruposFiltrados(): GrupoCatalogo[] {
    if (this.gradoFiltro === 'all') {
      return this.gruposDisponibles;
    }
    const grado = Number(this.gradoFiltro);
    return this.gruposDisponibles.filter((g) => g.grado === grado);
  }

  get materiasFiltradas(): MateriaCatalogo[] {
    if (this.gradoFiltro === 'all') {
      return this.materiasDisponibles;
    }
    const grado = Number(this.gradoFiltro);
    return this.materiasDisponibles.filter((m) => m.grado === grado);
  }

  onToggleGrupo(nombre: string, checked: boolean) {
    if (checked) {
      if (!this.gruposSeleccionados.includes(nombre)) {
        this.gruposSeleccionados.push(nombre);
      }
      return;
    }
    this.gruposSeleccionados = this.gruposSeleccionados.filter((g) => g !== nombre);
  }

  onToggleMateria(nombre: string, checked: boolean) {
    if (checked) {
      if (!this.materiasSeleccionadas.includes(nombre)) {
        this.materiasSeleccionadas.push(nombre);
      }
      return;
    }
    this.materiasSeleccionadas = this.materiasSeleccionadas.filter((m) => m !== nombre);
  }

  onToggleTodosGrupos(checked: boolean) {
    this.gruposSeleccionados = checked ? this.gruposFiltrados.map((g) => g.nombre) : [];
  }

  onToggleTodasMaterias(checked: boolean) {
    this.materiasSeleccionadas = checked ? this.materiasFiltradas.map((m) => m.nombre) : [];
  }

  sonTodosGruposSeleccionados(): boolean {
    const visibles = this.gruposFiltrados.map((g) => g.nombre);
    return visibles.length > 0 && visibles.every((nombre) => this.gruposSeleccionados.includes(nombre));
  }

  sonTodasMateriasSeleccionadas(): boolean {
    const visibles = this.materiasFiltradas.map((m) => m.nombre);
    return visibles.length > 0 && visibles.every((nombre) => this.materiasSeleccionadas.includes(nombre));
  }

  onChangeGradoFiltro() {
    const gruposVisibles = new Set(this.gruposFiltrados.map((g) => g.nombre));
    const materiasVisibles = new Set(this.materiasFiltradas.map((m) => m.nombre));
    this.gruposSeleccionados = this.gruposSeleccionados.filter((g) => gruposVisibles.has(g));
    this.materiasSeleccionadas = this.materiasSeleccionadas.filter((m) => materiasVisibles.has(m));
  }

  getClase(data: any[], dia: string, hora: string): any {
    return data.find((clase) => this.classOccupiesSlot(clase, dia, hora)) || null;
  }


  getClaseProfesor(clases: any[], dia: string, hora: string): any {
    return clases.find((clase) => this.classOccupiesSlot(clase, dia, hora)) || null;
  }

  getClasesProfesor(clases: any[], dia: string, hora: string): any[] {
    return clases.filter((clase) => this.classOccupiesSlot(clase, dia, hora));
  }

  private classOccupiesSlot(clase: any, dia: string, hora: string): boolean {
    if (typeof clase?.start !== 'string' || !clase.start.startsWith(dia)) {
      return false;
    }

    const startHour = Number(clase.start.substring(3, 5));
    const targetHour = Number(hora);
    const duration = Math.max(1, Number(clase.len ?? 1));
    return targetHour >= startHour && targetHour < startHour + duration;
  }

  ngOnInit() {
    const usuarioData = localStorage.getItem('userData');
    if (usuarioData) {
      const parsed = JSON.parse(usuarioData);
      const full_name = parsed.full_name;
      const turno = parsed?.metadata?.turno;
      this.usuarioNombre = full_name || 'Usuario';
      this.usuarioTurno = turno || 'Sin turno';

    } else {
      this.usuarioNombre = 'Usuario';
      this.usuarioTurno = '';
    }
    void this.cargarCatalogos();
    this.cargarHorariosCreados();
  }

  async cargarCatalogos() {
    await Promise.all([
      this.cargarGruposDisponibles(),
      this.cargarMateriasDisponibles(),
    ]);
  }

  async cargarGruposDisponibles() {
    try {
      const res = await fetch(`${environment.apiBaseUrl}/grupos`, {
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error al obtener grupos');
      const data = await res.json();
      this.gruposDisponibles = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('No se pudieron cargar los grupos', err);
      this.gruposDisponibles = [];
    }
  }

  async cargarMateriasDisponibles() {
    try {
      const res = await fetch(`${environment.apiBaseUrl}/materias`, {
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error al obtener materias');
      const data = await res.json();
      this.materiasDisponibles = Array.isArray(data)
        ? data.map((materia: any) => ({
            id: materia.id,
            nombre: materia.nombre,
            grado: materia.grado,
            permitir_doble_bloque: Boolean(materia.permitir_doble_bloque),
          }))
        : [];
    } catch (err) {
      console.error('No se pudieron cargar las materias', err);
      this.materiasDisponibles = [];
    }
  }

  getGrupoLabel(grupo: GrupoCatalogo): string {
    return `${grupo.nombre} · ${grupo.grado}°`;
  }

  getMateriaLabel(materia: MateriaCatalogo): string {
    const grado = materia.grado ? ` · ${materia.grado}°` : '';
    return `${materia.nombre}${grado}`;
  }

  hasRecesoAfter(hora: string): boolean {
    return hora === '03';
  }

  private groupMissingSubjects(items: MissingSubjectItem[]): MissingByGroup[] {
    const map = new Map<string, string[]>();
    for (const item of items) {
      if (!map.has(item.group)) {
        map.set(item.group, []);
      }
      map.get(item.group)!.push(`${item.subject} (-${item.missing})`);
    }
    return Array.from(map.entries()).map(([group, groupedItems]) => ({
      group,
      items: groupedItems,
    }));
  }

  private formatProfesorCell(clases: any[]): string {
    if (!Array.isArray(clases) || clases.length === 0) {
      return '';
    }
    return clases
      .map((clase) => {
        const grupo = clase.group || clase.grupo || '-';
        const salon = clase.room || 'Sin salón';
        return `${clase.subj}\nGrupo: ${grupo}\n${salon}`;
      })
      .join('\n----------------\n');
  }

  openMoveEditor(groupName: string, clase: HorarioClase) {
    const day = typeof clase.start === 'string' ? clase.start.slice(0, 3) : 'Lun';
    const hour = typeof clase.start === 'string' ? clase.start.slice(3, 5) : '01';
    this.moveEditor = {
      groupName,
      clase,
      toDay: day,
      toHour: hour,
    };
  }

  closeMoveEditor() {
    this.moveEditor = null;
  }

  private getGroupGrade(groupName: string): number | null {
    const group = this.gruposDisponibles.find((g) => g.nombre === groupName);
    return group?.grado ?? null;
  }

  private buildFillOptions(groupName: string): FillOption[] {
    const missing = this.warningMissingSubjects
      .filter((m) => m.group === groupName)
      .map((m) => ({ subject: m.subject, missing: m.missing }))
      .sort((a, b) => b.missing - a.missing);

    const grade = this.getGroupGrade(groupName);
    const allSubjects = this.materiasDisponibles
      .filter((m) => (grade ? m.grado === grade : true))
      .map((m) => ({ subject: m.nombre, missing: 0 }));

    const merged = new Map<string, FillOption>();
    [...missing, ...allSubjects].forEach((item) => {
      if (!merged.has(item.subject)) {
        merged.set(item.subject, item);
      }
    });
    return Array.from(merged.values());
  }

  openFillEditor(groupName: string, day: string, hour: string) {
    const options = this.buildFillOptions(groupName);
    if (options.length === 0) {
      this.isSuccess = false;
      this.message = 'No hay materias disponibles para rellenar este hueco.';
      return;
    }

    this.fillEditor = {
      groupName,
      day,
      hour,
      start: `${day}${hour}`,
      selectedSubject: options[0].subject,
      options,
    };
  }

  closeFillEditor() {
    this.fillEditor = null;
  }

  async applyManualFill() {
    if (!this.fillEditor || !this.fillEditor.selectedSubject) return;

    this.filling = true;
    try {
      const res = await fetch(`${environment.apiBaseUrl}/scheduler/manual-add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          groupName: this.fillEditor.groupName,
          start: this.fillEditor.start,
          subject: this.fillEditor.selectedSubject,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.isSuccess = false;
        this.message = data?.message || data?.error || 'No se pudo rellenar el hueco';
        return;
      }

      this.isSuccess = true;
      this.message = data?.result?.message || 'Hueco rellenado correctamente.';
      this.closeFillEditor();
      await this.cargarHorariosCreados();
    } catch {
      this.isSuccess = false;
      this.message = 'Error al rellenar el hueco.';
    } finally {
      this.filling = false;
    }
  }

  async applyManualMove() {
    if (!this.moveEditor) return;

    const toStart = `${this.moveEditor.toDay}${this.moveEditor.toHour}`;
    if (toStart === this.moveEditor.clase.start) {
      this.message = 'Selecciona un bloque distinto para mover la clase.';
      this.isSuccess = false;
      return;
    }

    this.moving = true;
    try {
      const res = await fetch(`${environment.apiBaseUrl}/scheduler/manual-move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          groupName: this.moveEditor.groupName,
          fromStart: this.moveEditor.clase.start,
          toStart,
          subject: this.moveEditor.clase.subj,
          professor: this.moveEditor.clase.prof,
          room: this.moveEditor.clase.room,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.isSuccess = false;
        this.message = data?.message || data?.error || 'No se pudo mover la clase';
        return;
      }

      this.isSuccess = true;
      this.message = data?.result?.message || 'Clase movida correctamente.';
      this.closeMoveEditor();
      await this.cargarHorariosCreados();
    } catch (error) {
      this.isSuccess = false;
      this.message = 'Error al mover clase manualmente.';
    } finally {
      this.moving = false;
    }
  }

  private buildPayload() {
    if (this.generarTodo) {
      return {};
    }

    const payload: Record<string, unknown> = {};
    if (this.gradoFiltro !== 'all') {
      payload['grado'] = Number(this.gradoFiltro);
    }
    if (this.gruposSeleccionados.length > 0) {
      payload['grupos'] = this.gruposSeleccionados;
    }
    if (this.materiasSeleccionadas.length > 0) {
      payload['materias'] = this.materiasSeleccionadas;
    }
    return payload;
  }

  async cargarHorariosCreados() {
    try {
      const res = await fetch(`${environment.apiBaseUrl}/scheduler/allschedules`);
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
        const clasesTodas: any[] = schedulesArray.flatMap((g: any) =>
          Array.isArray(g.data)
            ? g.data.map((clase: any) => ({
                ...clase,
                group: clase.group || clase.grupo || g.nombregrupo || g.groupName,
              }))
            : [],
        );
        const profesoresMap: { [nombre: string]: { displayName: string; clases: any[] } } = {};
        for (const clase of clasesTodas) {
          const rawName = typeof clase.prof === 'string' ? clase.prof : '';
          const displayName = rawName.trim().replace(/\s+/g, ' ');
          if (displayName) {
            const key = this.normalizeKey(displayName);
            if (!profesoresMap[key]) {
              profesoresMap[key] = { displayName, clases: [] };
            }
            profesoresMap[key].clases.push({
              ...clase,
              prof: displayName,
            });
          }
        }
        this.profesoresConHorarios = Object.values(profesoresMap).map((entry) => ({
          nombre: entry.displayName,
          clases: entry.clases,
        }));
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
    this.warningMissingSubjects = [];
    this.warningMissingByGroup = [];

    const payload = this.buildPayload();

    if (!this.generarTodo) {
      const hasFilters =
        this.gradoFiltro !== 'all' ||
        this.gruposSeleccionados.length > 0 ||
        this.materiasSeleccionadas.length > 0;
      if (!hasFilters) {
        this.loading = false;
        this.isSuccess = false;
        this.message = 'Selecciona al menos un filtro o activa "Generar todo".';
        return;
      }
    }

    fetch(`${environment.apiBaseUrl}/scheduler/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          const details = errorBody?.details || errorBody?.error || errorBody?.message;
          throw new Error(details ? `Error al generar los horarios: ${details}` : 'Error al generar los horarios');
        }
        const response = await res.json();
        const generation = response?.result ?? response;
        const missingSubjects: MissingSubjectItem[] = Array.isArray(generation?.missingSubjects)
          ? generation.missingSubjects
          : [];
        const missingCount = missingSubjects.length;
        this.loading = false;
        if (generation?.status === 'warning') {
          this.isSuccess = false;
          this.warningMissingSubjects = missingSubjects;
          this.warningMissingByGroup = this.groupMissingSubjects(this.warningMissingSubjects);
          this.message = `${generation?.message || 'Se generó un horario parcial.'}${missingCount > 0 ? ` Materias con horas faltantes: ${missingCount}.` : ''}`;
        } else {
          this.isSuccess = true;
          this.message = 'Horarios generados correctamente.';
          this.warningMissingSubjects = [];
          this.warningMissingByGroup = [];
        }
        await this.cargarHorariosCreados();
        console.log('Respuesta del backend:', response);
      })
      .catch(error => {
        this.loading = false;
        this.isSuccess = false;
        this.warningMissingSubjects = [];
        this.warningMissingByGroup = [];
        this.message = error?.message || 'Ocurrió un error al generar los horarios.';
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

    // InformaciÃ³n del grupo
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
      const row: any[] = [this.bloquesLabel[hora] || hora];
      for (const dia of this.diasSemana) {
        const clase = this.getClase(group.data, dia, hora);
        if (clase) {
          row.push([
            clase.subj,
            clase.prof || 'Sin profesor',
            clase.room || 'Sin salÃ³n'
          ].filter(Boolean).join('\n'));
        } else {
          row.push('');
        }
      }
      body.push(row);
      if (hora === '03') {
        body.push([
          '09:30-09:50',
          {
            content: 'RECESO',
            colSpan: this.diasSemana.length,
            styles: {
              halign: 'center',
              fillColor: [234, 243, 251],
              textColor: [0, 91, 170],
              fontStyle: 'bold',
            },
          },
        ]);
      }
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

    // Pie de pÃ¡gina
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Documento generado automÃ¡ticamente por el sistema de horarios escolar', 105, 290, { align: 'center' });
    }

    doc.save(`horario_${group.nombregrupo}.pdf`);
  }


  // ...mantener el resto del cÃ³digo igual...

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

    // InformaciÃ³n del profesor
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
      const row: any[] = [this.bloquesLabel[hora] || hora];
      for (const dia of this.diasSemana) {
        const clasesBloque = this.getClasesProfesor(prof.clases, dia, hora);
        if (clasesBloque.length > 0) {
          row.push(this.formatProfesorCell(clasesBloque));
        } else {
          row.push('');
        }
      }
      body.push(row);
      if (hora === '03') {
        body.push([
          '09:30-09:50',
          {
            content: 'RECESO',
            colSpan: this.diasSemana.length,
            styles: {
              halign: 'center',
              fillColor: [234, 243, 251],
              textColor: [0, 91, 170],
              fontStyle: 'bold',
            },
          },
        ]);
      }
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

    // Pie de pÃ¡gina
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Documento generado automÃ¡ticamente por el sistema de horarios escolar', 105, 290, { align: 'center' });
    }

    doc.save(`horario_profesor_${prof.nombre}.pdf`);
  }

  exportarTodosLosPDFGrupos() {
    for (const group of this.groupedSchedules) {
      this.exportarPDF(group);
    }
  }
}

