import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-bienvenida',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './bienvenida.html',
  styleUrls: ['./bienvenida.scss']
})
export class BienvenidaComponent {
  email: string = '';
  contrasena: string = '';
  showPassword: boolean = false;

  constructor(private router: Router) { }

  async iniciarSesion() {
    try {
      const res = await fetch(`${environment.apiBaseUrl}/users/login-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.email,
          password: this.contrasena
        })
      });

      const data = await res.json();
      console.log('Respuesta login:', data);

      console.log('Respuesta login:', data.user);

      if (data.access_token) {
        // GUARDAR TOKEN
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        this.router.navigate(['/dashboard']);

      } else {
        alert(data.error || 'Credenciales incorrectas');
        console.error('Error de login:', data);
      }

    } catch (error) {
      console.error('Error al conectar con el servidor:', error);
      alert('Error al conectar con el servidor');
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

}

