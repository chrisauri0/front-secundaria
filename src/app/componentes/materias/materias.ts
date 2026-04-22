
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfirmDialogService } from '../shared/confirm-dialog/confirm-dialog.service';

export interface Materia {
  id: string;
  nombre: string;
  grado?: number;
  horas_semana: number;
  permitir_doble_bloque?: boolean;
  data?: object;
  salones?: string[] | string | null;
}

@Component({
  selector: 'app-materias',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './materias.html',
  styleUrl: './materias.scss'
})
export class Materias {
  materias: Materia[] = [];
  nuevaMateria: Materia = { id: '', nombre: '', grado: 1, horas_semana: 1, permitir_doble_bloque: false, data: {}, salones: [] };
  selectedSalones: string[] = [];
  editandoId: string | null = null;
  salones: string[] = [];
  toastVisible = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'warning' = 'success';

  constructor(private confirmDialog: ConfirmDialogService) {}

  ngOnInit() {
    this.cargarMaterias();
    this.cargarSalones();
    console.log('Salones materias:', this.materias);
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

  private normalizeMateriaName(value: string) {
    return value.trim().toLowerCase();
  }

  private isNombreDuplicado(nombre: string, excludeId?: string): boolean {
    const normalized = this.normalizeMateriaName(nombre);
    return this.materias.some((m) =>
      m.id !== excludeId && this.normalizeMateriaName(m.nombre) === normalized && (m.grado ?? 1) === (this.nuevaMateria.grado ?? 1)
    );
  }

  getGradoLabel(grado?: number): string {
    switch (grado) {
      case 1:
        return '1°';
      case 2:
        return '2°';
      case 3:
        return '3°';
      default:
        return 'Sin grado';
    }
  }

  private normalizeSalones(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((v) => String(v)).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return [value.trim()];
    }
    return [];
  }

  formatSalones(value: unknown): string {
    const normalized = this.normalizeSalones(value);
    return normalized.length > 0 ? normalized.join(', ') : 'Sin salón';
  }

  toggleSalonSelection(salon: string, checked: boolean) {
    if (checked) {
      if (this.selectedSalones.includes(salon)) {
        return;
      }
      if (this.selectedSalones.length >= 2) {
        this.showToast('Solo puedes seleccionar hasta 2 salones', 'warning');
        return;
      }
      this.selectedSalones = [...this.selectedSalones, salon];
      return;
    }

    this.selectedSalones = this.selectedSalones.filter((s) => s !== salon);
  }

  async cargarSalones() {
    try {
      const res = await fetch('http://localhost:3000/salones', {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al obtener salones');
      const data = await res.json();
      this.salones = Array.isArray(data) ? data.map((s: any) => s.nombre) : [];
    } catch (err) {
      this.showToast('No se pudo cargar la lista de salones', 'error');
    }
  }

  async cargarMaterias() {
    const localKey = 'materias-caches';
    const localHashKey = 'materias-cache-hash';
    // Intenta cargar desde localStorage
    const cache = localStorage.getItem(localKey);
    localStorage.getItem(localHashKey);
    let materiasLocal: Materia[] = [];
    if (cache) {
      try {
        materiasLocal = JSON.parse(cache);
        this.materias = materiasLocal;
        console.log('Cargado desde cache localStorage');
      } catch { }
    }

    try {

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
        permitir_doble_bloque: Boolean(m.permitir_doble_bloque),
        data: m.data || {},
        salones: this.normalizeSalones(m.salones)
      })) : [];
      localStorage.setItem(localKey, JSON.stringify(this.materias));
    } catch (err) {
      this.showToast('No se pudo cargar la lista de materias', 'error');
    }
  }

  async agregarMateria() {
    if (!this.nuevaMateria.nombre.trim()) {
      this.showToast('Debes capturar el nombre de la materia', 'warning');
      return;
    }

    if (![1, 2, 3].includes(Number(this.nuevaMateria.grado))) {
      this.showToast('Selecciona un grado válido', 'warning');
      return;
    }

    if (this.isNombreDuplicado(this.nuevaMateria.nombre)) {
      this.showToast('Ya existe una materia con ese nombre', 'warning');
      return;
    }

    const body = {
      nombre: this.nuevaMateria.nombre,
      grado: this.nuevaMateria.grado || 1,
      horas_semana: this.nuevaMateria.horas_semana || 1,
      permitir_doble_bloque: Boolean(this.nuevaMateria.permitir_doble_bloque),
      data: this.nuevaMateria.data || {},
      salones: this.selectedSalones
    };

    if (body.salones.length === 0) {
      this.showToast('Selecciona al menos un salón', 'warning');
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/materias', {
        method: 'POST',
        headers: this.getAuthHeaders(true),
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Error al crear la materia');
      const data = await res.json();
      this.materias.push({
        id: data.id || Date.now().toString(),
        nombre: data.nombre,
        grado: data.grado,
        horas_semana: data.horas_semana,
        permitir_doble_bloque: Boolean(data.permitir_doble_bloque),
        salones: this.normalizeSalones(data.salones)
      });
      this.nuevaMateria = { id: '', nombre: '', grado: 1, horas_semana: 1, permitir_doble_bloque: false, data: {}, salones: [] };
      this.selectedSalones = [];
      this.showToast('Materia creada correctamente', 'success');
    } catch (err) {
      this.showToast('No se pudo crear la materia', 'error');
    }
  }

  async guardarEdicion() {
    if (!this.nuevaMateria.nombre.trim() || !this.editandoId) {
      this.showToast('Debes capturar el nombre de la materia', 'warning');
      return;
    }

    if (![1, 2, 3].includes(Number(this.nuevaMateria.grado))) {
      this.showToast('Selecciona un grado válido', 'warning');
      return;
    }

    if (this.isNombreDuplicado(this.nuevaMateria.nombre, this.editandoId)) {
      this.showToast('Ya existe una materia con ese nombre', 'warning');
      return;
    }

    const body: any = {
      nombre: this.nuevaMateria.nombre,
      grado: this.nuevaMateria.grado || 1,
      data: this.nuevaMateria.data || {},
      horas_semana: this.nuevaMateria.horas_semana || 1,
      permitir_doble_bloque: Boolean(this.nuevaMateria.permitir_doble_bloque),
      salones: this.selectedSalones
    };

    if (body.salones.length === 0) {
      this.showToast('Selecciona al menos un salón', 'warning');
      return;
    }

    try {
      const res = await fetch(`http://localhost:3000/materias/${this.editandoId}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(true),
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Error al editar la materia');
      const data = await res.json();
      this.materias = this.materias.map(m => m.id === this.editandoId ? {
        id: this.editandoId!,
        nombre: body.nombre,
        grado: body.grado,
        horas_semana: body.horas_semana,
        permitir_doble_bloque: Boolean(body.permitir_doble_bloque),
        data: body.data,
        salones: this.normalizeSalones(body.salones)
      } : m);
      this.nuevaMateria = { id: '', nombre: '', grado: 1, horas_semana: 1, permitir_doble_bloque: false, data: {}, salones: [] };
      this.selectedSalones = [];
      this.editandoId = null;
      this.showToast('Materia editada correctamente', 'success');
    } catch (err) {
      this.showToast('No se pudo editar la materia', 'error');
    }
  }

  async eliminarMateria(id: string) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar materia',
      message: '¿Deseas eliminar esta materia? Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`http://localhost:3000/materias/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al eliminar la materia');
      this.materias = this.materias.filter(m => m.id !== id);
      this.showToast('Materia eliminada correctamente', 'success');
    } catch (err) {
      this.showToast('No se pudo eliminar la materia', 'error');
    }
  }

  editarMateria(materia: Materia) {
    this.editandoId = materia.id;
    this.nuevaMateria = {
      ...materia,
      salones: this.normalizeSalones(materia.salones)
    };
    this.selectedSalones = this.normalizeSalones(materia.salones).slice(0, 2);
  }

  cancelarEdicion() {
    this.nuevaMateria = { id: '', nombre: '', grado: 1, horas_semana: 1, permitir_doble_bloque: false, data: {}, salones: [] };
    this.selectedSalones = [];
    this.editandoId = null;
  }
}
