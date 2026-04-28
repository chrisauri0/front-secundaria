import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfirmDialogService } from '../shared/confirm-dialog/confirm-dialog.service';
import { environment } from '../../../environments/environment';

interface UserRow {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  activo?: boolean;
}

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class UsersComponent {
  users: UserRow[] = [];
  filtroUsers = '';
  nuevo = { id: '', email: '', passwordHash: '', fullName: '', role: 'user' };
  editandoId: string | null = null;

  constructor(private confirmDialog: ConfirmDialogService) {}

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    const res = await fetch(`${environment.apiBaseUrl}/users`);
    const data = await res.json();
    this.users = Array.isArray(data) ? data : [];
  }

  async guardar() {
    if (!this.nuevo.email.trim()) return;

    if (this.editandoId) {
      const res = await fetch(`${environment.apiBaseUrl}/users/${this.editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.nuevo.email,
          fullName: this.nuevo.fullName,
          role: this.nuevo.role,
        }),
      });
      if (!res.ok) return;
    } else {
      const res = await fetch(`${environment.apiBaseUrl}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.nuevo),
      });
      if (!res.ok) return;
    }

    this.cancelar();
    await this.cargar();
  }

  get usersFiltrados(): UserRow[] {
    const term = this.filtroUsers.trim().toLowerCase();
    if (!term) return this.users;
    return this.users.filter((u) =>
      `${u.email} ${u.full_name || ''} ${u.role || ''}`.toLowerCase().includes(term),
    );
  }

  limpiarFiltros() {
    this.filtroUsers = '';
  }

  editar(user: UserRow) {
    this.editandoId = user.id;
    this.nuevo = {
      id: user.id,
      email: user.email,
      passwordHash: '',
      fullName: user.full_name || '',
      role: user.role || 'user',
    };
  }

  cancelar() {
    this.editandoId = null;
    this.nuevo = { id: '', email: '', passwordHash: '', fullName: '', role: 'user' };
  }

  async eliminar(id: string) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar usuario',
      message: '¿Deseas eliminar este usuario? Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;
    const res = await fetch(`${environment.apiBaseUrl}/users/${id}`, { method: 'DELETE' });
    if (res.ok) await this.cargar();
  }
}
