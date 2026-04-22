import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfirmDialogService } from '../shared/confirm-dialog/confirm-dialog.service';
export interface salonesData {
  id: string;
  nombre: string;
  edificio_id: string;
  edificioNombre?: string;
  capacidad?: number;
}

@Component({
  selector: 'app-salones',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './salones.html',
  styleUrls: ['./salones.scss']
})
export class SalonesComponent {
  usuarioNombre: string = '';
  sidebarCollapsed = false;


  salones: salonesData[] = [];
  edificios: Array<{ id: string; nombre: string }> = [];
  nuevoSalon: salonesData = { id: '', nombre: '', edificio_id: '', capacidad: 35 };
  editandoId: string | null = null;
  toastVisible = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'warning' = 'success';

  constructor(private confirmDialog: ConfirmDialogService) {}

  ngOnInit() {
    const usuarioData = localStorage.getItem('userData');
    if (usuarioData) {
      const { full_name } = JSON.parse(usuarioData);
      this.usuarioNombre = full_name || 'Usuario';

    } else {
      this.usuarioNombre = 'Usuario';
    }
    this.cargarEdificios();
    this.cargarSalones();
  }
  async cargarEdificios() {
    try {
      const res = await fetch('http://localhost:3000/edificios', {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al obtener edificios');
      const data = await res.json();
      this.edificios = Array.isArray(data) ? data.map((e: any) => ({ id: e.id, nombre: e.nombre })) : [];
      if (!this.nuevoSalon.edificio_id && this.edificios.length > 0) {
        this.nuevoSalon.edificio_id = this.edificios[0].id;
      }
    } catch {
      this.showToast('No se pudo cargar la lista de edificios', 'error');
    }
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

  async cargarSalones() {
    // Intentar cargar desde localStorage primero
    const cache = localStorage.getItem('salonesCache');
    if (cache) {
      try {
        const cacheData = JSON.parse(cache);
        this.salones = Array.isArray(cacheData) ? cacheData : [];
      } catch { }
    }

    try {
      const res = await fetch('http://localhost:3000/salones', {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al obtener salones');
      const data = await res.json();
      // La nueva API devuelve { id, nombre, data } donde data puede tener edificio
      const salonesList = Array.isArray(data) ? data.map((s, idx) => ({
        id: s.id || idx,
        nombre: s.nombre,
        edificio_id: s.edificio_id,
        edificioNombre: s?.edificio?.nombre || '',
        capacidad: s.capacidad ?? 35
      })) : [];
      // Solo actualiza si hay cambios
      if (JSON.stringify(salonesList) !== localStorage.getItem('salonesCache')) {
        this.salones = salonesList;
        localStorage.setItem('salonesCache', JSON.stringify(salonesList));
      }
    } catch (err) {
      this.showToast('No se pudo cargar la lista de salones', 'error');
    }
  }

  async agregarSalon() {
    if (!this.nuevoSalon.nombre.trim()) {
      this.showToast('Debes capturar el nombre del salón', 'warning');
      return;
    }

    if (!this.nuevoSalon.edificio_id) {
      this.showToast('Selecciona un edificio para el salón', 'warning');
      return;
    }

    const duplicated = this.salones.some((s) =>
      s.nombre.trim().toLowerCase() === this.nuevoSalon.nombre.trim().toLowerCase()
      && s.edificio_id === this.nuevoSalon.edificio_id
    );

    if (duplicated) {
      this.showToast('Ya existe un salón con el mismo nombre y edificio', 'warning');
      return;
    }

    const body = {
      nombre: this.nuevoSalon.nombre,
      edificio_id: this.nuevoSalon.edificio_id,
      capacidad: this.nuevoSalon.capacidad || 35,
      data: {}
    };
    try {
      const res = await fetch('http://localhost:3000/salones', {
        method: 'POST',
        headers: this.getAuthHeaders(true),
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Error al crear el salÃ³n');
      const data = await res.json();

      if (data.error) {
        this.showToast(data.error, 'warning');
        return;
      }
      this.salones.push({
        id: data.id || Date.now(),
        nombre: data.nombre,
        edificio_id: data.edificio_id,
        edificioNombre: this.edificios.find((e) => e.id === data.edificio_id)?.nombre || '',
        capacidad: data.capacidad ?? 35
      });
      this.nuevoSalon = { id: '', nombre: '', edificio_id: this.nuevoSalon.edificio_id, capacidad: 35 };
      this.showToast('Salón creado correctamente', 'success');
    } catch (err) {
      this.showToast('No se pudo crear el salón', 'error');
    }
  }

  async eliminarSalon(id: string) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar salón',
      message: '¿Deseas eliminar este salón? Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`http://localhost:3000/salones/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al eliminar el salÃ³n');
      this.salones = this.salones.filter(s => s.id !== id);
      this.showToast('Salón eliminado correctamente', 'success');
    } catch (err) {
      this.showToast('No se pudo eliminar el salón', 'error');
    }
  }

  editarSalon(salon: salonesData) {
    this.editandoId = salon.id;
    this.nuevoSalon = {
      id: salon.id,
      nombre: salon.nombre,
      edificio_id: salon.edificio_id,
      capacidad: salon.capacidad || 35,
      edificioNombre: salon.edificioNombre,
    };
  }

  async guardarEdicion() {
    if (!this.nuevoSalon.nombre.trim()) {
      this.showToast('Debes capturar el nombre del salón', 'warning');
      return;
    }
    if (!this.editandoId) return;

    const duplicated = this.salones.some((s) =>
      s.id !== this.editandoId
      && s.nombre.trim().toLowerCase() === this.nuevoSalon.nombre.trim().toLowerCase()
      && s.edificio_id === this.nuevoSalon.edificio_id
    );

    if (duplicated) {
      this.showToast('Ya existe un salón con el mismo nombre y edificio', 'warning');
      return;
    }

    const body: any = {
      nombre: this.nuevoSalon.nombre,
      edificio_id: this.nuevoSalon.edificio_id,
      capacidad: this.nuevoSalon.capacidad || 35,
      data: {}
    };
    try {
      const res = await fetch(`http://localhost:3000/salones/${this.editandoId}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(true),
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Error al editar el salÃ³n');
      const data = await res.json();
      this.salones = this.salones.map(s => s.id === this.editandoId ? {
        id: this.editandoId!,
        nombre: body.nombre,
        edificio_id: body.edificio_id,
        edificioNombre: this.edificios.find((e) => e.id === body.edificio_id)?.nombre || '',
        capacidad: body.capacidad
      } : s);
      this.nuevoSalon = { id: '', nombre: '', edificio_id: this.nuevoSalon.edificio_id, capacidad: 35 };
      this.editandoId = null;
      this.showToast('Salón editado correctamente', 'success');
    } catch (err) {
      this.showToast('No se pudo editar el salón', 'error');
    }
  }

  cancelarEdicion() {
    this.nuevoSalon = { id: '', nombre: '', edificio_id: this.nuevoSalon.edificio_id, capacidad: 35 };
    this.editandoId = null;
  }
}


