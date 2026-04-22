import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Materia } from '../materias/materias';
import { RouterModule } from '@angular/router';
import { ConfirmDialogService } from '../shared/confirm-dialog/confirm-dialog.service';

export interface ProfesorData {
  profesor_id: string;
  nombre: string;
  apellidos: string;
  min_hora?: number;
  max_hora?: number;
  hora_empezar?: string;
  hora_terminar?: string;
  materias?: string[];
  metadata?: object;
}

@Component({
  selector: 'app-profesores',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, RouterModule],
  templateUrl: './profesores.html',
  styleUrls: ['./profesores.scss']
})
export class ProfesoresComponent {
  profesores: ProfesorData[] = [];
  materias: Materia[] = [];
  materiasOpciones: string[] = [];
  toastVisible = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'warning' = 'success';
  nuevoProfesor: ProfesorData = {
    profesor_id: '',
    nombre: '',
    apellidos: '',
    hora_empezar: '17:00',
    hora_terminar: '21:00',
    materias: [],
    metadata: {}
  };
  editandoId: string | null = null;

  constructor(private confirmDialog: ConfirmDialogService) {}

  ngOnInit() {
    this.cargarProfesores();
    this.cargarMaterias();
  }

  private getAuthHeaders(includeContentType = false): HeadersInit {
    const token = localStorage.getItem('token') || '';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`
    };
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  private showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    this.toastVisible = true;
    setTimeout(() => {
      this.toastVisible = false;
    }, 2600);
  }


  async cargarMaterias() {
    const localKey = 'materias-cache';
    const localHashKey = 'materias-cache-hash';
    // Intenta cargar desde localStorage
    const cache = localStorage.getItem(localKey);
    const cacheHash = localStorage.getItem(localHashKey);
    let materiasLocal: Materia[] = [];
    if (cache) {
      try {
        materiasLocal = JSON.parse(cache);
        this.materias = materiasLocal;
        this.materiasOpciones = materiasLocal.map(m => m.nombre);
        console.log('Cargado desde cache localStorage');
      } catch {
        // cache roto, se ignora
      }
    }

    // Siempre consulta el backend para obtener el hash actual
    try {
      const res = await fetch('http://localhost:3000/materias/hash', {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al obtener hash de materias');
      const { hash } = await res.json();
      if (hash === cacheHash && materiasLocal.length > 0) {
        // No hay cambios, no hace falta pedir la lista
        return;
      }
      // Si el hash cambiÃ³, pide la lista actualizada
      const resList = await fetch('http://localhost:3000/materias', {
        headers: this.getAuthHeaders()
      });
      if (!resList.ok) throw new Error('Error al obtener materias');
      const data = await resList.json();
      this.materias = Array.isArray(data) ? data.map((m: any) => ({
        id: m.id,
        nombre: m.nombre,
        grado: m.grado,
        horas_semana: m.horas_semana,
        data: m.data || {}
      })) : [];
      this.materiasOpciones = this.materias.map(m => m.nombre);
      localStorage.setItem(localKey, JSON.stringify(this.materias));
      localStorage.setItem(localHashKey, hash);
    } catch (err) {
      this.showToast('No se pudo cargar la lista de materias', 'error');
    }
  }

  private lastProfesoresJson: string = '';

  private toHourNumber(value?: string): number | undefined {
    if (!value) return undefined;
    const [hh] = value.split(':');
    const parsed = Number(hh);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toHourString(value?: number): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return `${String(value).padStart(2, '0')}:00`;
  }

  private buildProfesorBody() {
    const nombre = this.nuevoProfesor.nombre.trim();
    const apellidos = this.nuevoProfesor.apellidos.trim();
    const min_hora = this.toHourNumber(this.nuevoProfesor.hora_empezar);
    const max_hora = this.toHourNumber(this.nuevoProfesor.hora_terminar);

    if (min_hora === undefined || max_hora === undefined) {
      throw new Error('Debes capturar hora de inicio y hora de término');
    }

    if (max_hora < min_hora) {
      throw new Error('La hora de término no puede ser menor que la de inicio');
    }

    return {
      nombre,
      apellidos,
      min_hora,
      max_hora,
      materias: this.nuevoProfesor.materias,
      metadata: this.nuevoProfesor.metadata
    };
  }

  async cargarProfesores() {


    try {
      const res = await fetch('http://localhost:3000/profesores');
      if (!res.ok) throw new Error('Error al obtener profesores');
      const data = await res.json();
      const newJson = JSON.stringify(data);
      if (newJson === this.lastProfesoresJson) {
        // No hay cambios, no actualiza la lista
        return;
      }
      this.profesores = Array.isArray(data)
        ? data.map((p: ProfesorData) => ({
          ...p,
          hora_empezar: this.toHourString(p.min_hora),
          hora_terminar: this.toHourString(p.max_hora)
        }))
        : [];
      this.lastProfesoresJson = newJson;
      localStorage.setItem('profesoresCache', newJson);
    } catch (err) {
      alert('No se pudo cargar la lista de profesores: ' + err);
    }
  }

  async agregarProfesor() {
    let body: any;
    try {
      body = this.buildProfesorBody();
    } catch (err) {
      alert(String(err));
      return;
    }

    // Verificar si ya existe un profesor con los mismos datos
    const existe = this.profesores.some(p =>
      p.nombre === this.nuevoProfesor.nombre &&
      p.apellidos === this.nuevoProfesor.apellidos &&
      p.min_hora === body.min_hora &&
      p.max_hora === body.max_hora &&
      JSON.stringify(p.materias) === JSON.stringify(this.nuevoProfesor.materias) &&
      JSON.stringify(p.metadata) === JSON.stringify(this.nuevoProfesor.metadata)
    );
    if (existe) {
      this.showToast('Ya existe un profesor con esos datos', 'warning');
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/profesores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Error al crear el profesor');
      }
      // Usar el id real devuelto por el backend
      this.profesores.push({
        ...this.nuevoProfesor,
        profesor_id: data.profesor_id,
        min_hora: body.min_hora,
        max_hora: body.max_hora,
      });
      this.nuevoProfesor = {
        profesor_id: '',
        nombre: '',
        apellidos: '',
        hora_empezar: '17:00',
        hora_terminar: '21:00',
        materias: [],
        metadata: {}
      };
      this.showToast('Profesor creado correctamente', 'success');
    } catch (err) {
      this.showToast(String(err).replace(/^Error:\s*/, ''), 'error');
    }
  }

  async guardarEdicion() {
    if (!this.nuevoProfesor.nombre.trim()) return;
    if (!this.editandoId) return;

    let body: any;
    try {
      body = this.buildProfesorBody();
    } catch (err) {
      alert(String(err));
      return;
    }

    try {
      const res = await fetch(`http://localhost:3000/profesores/${this.editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || 'Error al actualizar el profesor');
      // Mantener el id al actualizar localmente
      this.profesores = this.profesores.map(p =>
        p.profesor_id === this.editandoId ? { ...p, ...body, profesor_id: p.profesor_id } : p
      );
      this.nuevoProfesor = {
        profesor_id: '',
        nombre: '',
        apellidos: '',
        hora_empezar: '17:00',
        hora_terminar: '21:00',
        materias: [],
        metadata: {}
      };
      this.editandoId = null;
      //recagar la lista de profesores para asegurar consistencia
      this.cargarProfesores();
      this.showToast('Profesor editado correctamente', 'success');
    } catch (err) {
      this.showToast(String(err).replace(/^Error:\s*/, ''), 'error');
    }
  }

  async eliminarProfesor(profesor_id: string) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar profesor',
      message: '¿Deseas eliminar este profesor? Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`http://localhost:3000/profesores/${profesor_id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Error al eliminar el profesor');
      this.profesores = this.profesores.filter(p => p.profesor_id !== profesor_id);
      this.showToast('Profesor eliminado correctamente', 'success');
    } catch (err) {
      this.showToast('No se pudo eliminar el profesor', 'error');
      console.log(profesor_id);
    }
  }

  editarProfesor(profesor: any) {
    this.editandoId = profesor.profesor_id;
    this.nuevoProfesor = { ...profesor };
    // Mover la vista hacia el formulario de ediciÃ³n, pero con un offset para que se vea completo
    const formElement = document.getElementById('profesorForm');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Esperar un poco para que el scroll termine y luego ajustar hacia arriba
      setTimeout(() => {
        window.scrollBy({ top: -170, left: 0, behavior: 'smooth' }); // Ajusta el offset segÃºn la altura de tu navbar
      }, 400);
    }
  }

  cancelarEdicion() {
    this.nuevoProfesor = {
      profesor_id: '',
      nombre: '',
      apellidos: '',
      hora_empezar: '17:00',
      hora_terminar: '21:00',
      materias: [],
      metadata: {}
    };
    this.editandoId = null;
  }
}

