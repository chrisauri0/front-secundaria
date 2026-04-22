import { CommonModule } from '@angular/common';
import { Component, signal, OnInit } from '@angular/core';
import { Router, RouterLink, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ConfirmDialogComponent } from './componentes/shared/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogService } from './componentes/shared/confirm-dialog/confirm-dialog.service';

/**
 * Componente principal de la aplicación.
 * Gestiona el layout, la sesión de usuario y la navegación principal.
 * Cumple buenas prácticas para trazabilidad y mantenibilidad.
 */

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, RouterLink, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  /** Título de la aplicación */
  protected readonly title = signal('sistema-de-horarios');

  /** Nombre del usuario autenticado */
  usuarioNombre: string = '';
  /** Estado del sidebar */
  sidebarCollapsed = false;
  /** Indica si se está en la pantalla de login */
  esLogin = false;
  /** Estado del menú superior responsive */
  navbarOpen = false;

  constructor(
    private router: Router,
    private confirmDialog: ConfirmDialogService,
  ) {
    // Detecta si la ruta actual es /login o la raíz para ocultar el layout
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.esLogin = event.url.includes('/login') || event.url === '/';
      });
  }

  /**
   * Inicializa los datos del usuario desde localStorage.
   * Si no existe información, asigna valores por defecto.
   */
  ngOnInit(): void {
    try {
      const usuarioData = localStorage.getItem('userData');
      if (usuarioData) {
        // Validación y parseo seguro
        const parsed = JSON.parse(usuarioData);
        this.usuarioNombre = typeof parsed.nombre === 'string' ? parsed.nombre : 'Usuario';
      } else {
        this.usuarioNombre = 'Coordinación Académica';
      }
    } catch (error) {
      // Manejo de error de parseo
      this.usuarioNombre = 'Usuario';
      // Se podría loggear el error si se cuenta con un sistema de logs
    }
  }

  /**
   * Cierra la sesión del usuario, eliminando datos y redirigiendo a login.
   * Incluye confirmación para evitar cierres accidentales.
   */
  async cerrarSesion(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Cerrar sesión',
      message: '¿Seguro que deseas cerrar sesión ahora?',
      confirmText: 'Sí, cerrar sesión',
      cancelText: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;
    localStorage.removeItem('userData');
    this.router.navigate(['/login']);
  }
}