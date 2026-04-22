import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfirmDialogService } from '../shared/confirm-dialog/confirm-dialog.service';

interface GrupoOption {
  id: string;
  nombre: string;
  limite_alumnos: number;
  _count?: { alumnos: number };
}

interface Alumno {
  id: string;
  nombre: string;
  direccion?: string;
  telefono_contacto?: string;
  email_contacto?: string;
  grupo_id?: string;
}

@Component({
  selector: 'app-alumnos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './alumnos.html',
  styleUrl: './alumnos.scss'
})
export class AlumnosComponent {
  alumnos: Alumno[] = [];
  grupos: GrupoOption[] = [];
  nuevo: Alumno = { id: '', nombre: '', direccion: '', telefono_contacto: '', email_contacto: '', grupo_id: '' };
  editandoId: string | null = null;
  toast = '';
  toastType: 'success' | 'error' | 'warning' = 'success';

  constructor(private confirmDialog: ConfirmDialogService) {}

  async ngOnInit() {
    await Promise.all([this.cargarGrupos(), this.cargarAlumnos()]);
  }

  private show(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
    this.toast = msg;
    this.toastType = type;
    setTimeout(() => (this.toast = ''), 2600);
  }

  async cargarGrupos() {
    const res = await fetch('http://localhost:3000/grupos');
    const data = await res.json();
    this.grupos = Array.isArray(data) ? data : [];
  }

  async cargarAlumnos() {
    const res = await fetch('http://localhost:3000/alumnos');
    const data = await res.json();
    this.alumnos = Array.isArray(data) ? data : [];
  }

  private canAssignToGroup(grupoId?: string, alumnoEditandoId?: string): boolean {
    if (!grupoId) return true;
    const grupo = this.grupos.find((g) => g.id === grupoId);
    if (!grupo) return false;
    const inscritos = this.alumnos.filter((a) => a.grupo_id === grupoId && a.id !== alumnoEditandoId).length;
    return inscritos < (grupo.limite_alumnos || 35);
  }

  getGrupoLabel(grupoId?: string): string {
    if (!grupoId) return 'Sin grupo';
    const grupo = this.grupos.find((g) => g.id === grupoId);
    return grupo?.nombre || 'Sin grupo';
  }

  getGrupoOcupacion(grupo: GrupoOption): string {
    const actuales = grupo?._count?.alumnos || 0;
    return `${grupo.nombre} (${actuales}/${grupo.limite_alumnos})`;
  }

  async guardar() {
    if (!this.nuevo.nombre.trim()) {
      this.show('El nombre es obligatorio', 'warning');
      return;
    }

    if (this.nuevo.grupo_id && !this.canAssignToGroup(this.nuevo.grupo_id, this.editandoId || undefined)) {
      this.show('El grupo ya alcanzó su límite de alumnos', 'warning');
      return;
    }

    const payload = {
      nombre: this.nuevo.nombre,
      direccion: this.nuevo.direccion || undefined,
      telefono_contacto: this.nuevo.telefono_contacto || undefined,
      email_contacto: this.nuevo.email_contacto || undefined,
      grupo_id: this.nuevo.grupo_id || undefined,
    };

    const url = this.editandoId
      ? `http://localhost:3000/alumnos/${this.editandoId}`
      : 'http://localhost:3000/alumnos';
    const method = this.editandoId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.error) {
      this.show(data?.error || 'No se pudo guardar el alumno', 'error');
      return;
    }

    this.nuevo = { id: '', nombre: '', direccion: '', telefono_contacto: '', email_contacto: '', grupo_id: '' };
    this.editandoId = null;
    await this.cargarAlumnos();
    this.show('Alumno guardado correctamente', 'success');
  }

  editar(alumno: Alumno) {
    this.editandoId = alumno.id;
    this.nuevo = { ...alumno };
  }

  cancelar() {
    this.editandoId = null;
    this.nuevo = { id: '', nombre: '', direccion: '', telefono_contacto: '', email_contacto: '', grupo_id: '' };
  }

  async eliminar(id: string) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar alumno',
      message: '¿Deseas eliminar este alumno? Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;
    const res = await fetch(`http://localhost:3000/alumnos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await this.cargarAlumnos();
      this.show('Alumno eliminado', 'success');
    }
  }
}
