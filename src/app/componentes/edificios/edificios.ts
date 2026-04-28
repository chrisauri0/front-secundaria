import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfirmDialogService } from '../shared/confirm-dialog/confirm-dialog.service';
import { environment } from '../../../environments/environment';

interface Edificio {
  id: string;
  nombre: string;
  descripcion?: string;
}

@Component({
  selector: 'app-edificios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './edificios.html',
  styleUrl: './edificios.scss'
})
export class EdificiosComponent {
  edificios: Edificio[] = [];
  filtroEdificios = '';
  nuevo: Edificio = { id: '', nombre: '', descripcion: '' };
  editandoId: string | null = null;
  toastVisible = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'warning' = 'success';

  constructor(private confirmDialog: ConfirmDialogService) {}

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    const res = await fetch(`${environment.apiBaseUrl}/edificios`);
    const data = await res.json();
    this.edificios = Array.isArray(data) ? data : [];
  }

  private showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    this.toastVisible = true;
    setTimeout(() => (this.toastVisible = false), 2600);
  }

  get edificiosFiltrados(): Edificio[] {
    const term = this.filtroEdificios.trim().toLowerCase();
    if (!term) return this.edificios;
    return this.edificios.filter((e) =>
      `${e.nombre} ${e.descripcion || ''}`.toLowerCase().includes(term),
    );
  }

  limpiarFiltros() {
    this.filtroEdificios = '';
  }

  async guardar() {
    if (!this.nuevo.nombre.trim()) {
      this.showToast('Debes capturar el nombre del edificio', 'warning');
      return;
    }

    const duplicated = this.edificios.some((edificio) =>
      edificio.nombre.trim().toLowerCase() === this.nuevo.nombre.trim().toLowerCase()
      && edificio.id !== this.editandoId
    );

    if (duplicated) {
      this.showToast('Ya existe un edificio con ese nombre', 'warning');
      return;
    }

    const isEdit = Boolean(this.editandoId);

    const url = this.editandoId
      ? `${environment.apiBaseUrl}/edificios/${this.editandoId}`
      : `${environment.apiBaseUrl}/edificios`;
    const method = this.editandoId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: this.nuevo.nombre, descripcion: this.nuevo.descripcion || null }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.error) {
      this.showToast(data?.error || 'No se pudo guardar el edificio', 'error');
      return;
    }

    this.nuevo = { id: '', nombre: '', descripcion: '' };
    this.editandoId = null;
    await this.cargar();
    this.showToast(isEdit ? 'Edificio editado correctamente' : 'Edificio creado correctamente', 'success');
  }

  editar(edificio: Edificio) {
    this.editandoId = edificio.id;
    this.nuevo = { ...edificio };
  }

  cancelar() {
    this.editandoId = null;
    this.nuevo = { id: '', nombre: '', descripcion: '' };
  }

  async eliminar(id: string) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar edificio',
      message: '¿Deseas eliminar este edificio? Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;
    const res = await fetch(`${environment.apiBaseUrl}/edificios/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await this.cargar();
      this.showToast('Edificio eliminado correctamente', 'success');
    } else {
      this.showToast('No se pudo eliminar el edificio', 'error');
    }
  }
}
