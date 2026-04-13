import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Materia } from '../materias/materias';
import { RouterModule } from '@angular/router';

export interface ProfesorData {
  profesor_id: string;
  nombre: string;
  apellidos: string;
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
  nuevoProfesor: ProfesorData = {
    profesor_id: '',
    nombre: '',
    apellidos: '',
    materias: [],
    metadata: {}
  };
  editandoId: string | null = null;

  ngOnInit() {
    this.cargarProfesores();
    this.cargarMaterias();
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
      } catch { }
    }

    // Siempre consulta el backend para obtener el hash actual
    try {
      const res = await fetch('https://horarios-backend-58w8.onrender.com/materias/hash');
      if (!res.ok) throw new Error('Error al obtener hash de materias');
      const { hash } = await res.json();
      if (hash === cacheHash && materiasLocal.length > 0) {
        // No hay cambios, no hace falta pedir la lista
        return;
      }
      // Si el hash cambió, pide la lista actualizada
      const resList = await fetch('https://horarios-backend-58w8.onrender.com/materias');
      if (!resList.ok) throw new Error('Error al obtener materias');
      const data = await resList.json();
      this.materias = Array.isArray(data) ? data.map((m: any) => ({
        id: m.id,
        nombre: m.nombre,
        grado: m.grado,
        carrera: m.carrera,
        horas_semana: m.horas_semana,
        data: m.data || {}
      })) : [];
      this.materiasOpciones = this.materias.map(m => m.nombre);
      localStorage.setItem(localKey, JSON.stringify(this.materias));
      localStorage.setItem(localHashKey, hash);
    } catch (err) {
      alert('No se pudo cargar la lista de materias: ' + err);
    }
  }

  private lastProfesoresJson: string = '';

  async cargarProfesores() {


    try {
      const res = await fetch('https://horarios-backend-58w8.onrender.com/profesores');
      if (!res.ok) throw new Error('Error al obtener profesores');
      const data = await res.json();
      const newJson = JSON.stringify(data);
      if (newJson === this.lastProfesoresJson) {
        // No hay cambios, no actualiza la lista
        return;
      }
      this.profesores = Array.isArray(data) ? data : [];
      this.lastProfesoresJson = newJson;
      localStorage.setItem('profesoresCache', newJson);
    } catch (err) {
      alert('No se pudo cargar la lista de profesores: ' + err);
    }
  }

  async agregarProfesor() {

    const nombre = this.nuevoProfesor.nombre.trim();
    const apellidos = this.nuevoProfesor.apellidos.trim();

    // Construir el body para el endpoint
    const body = {
      nombre,
      apellidos,
      materias: this.nuevoProfesor.materias,
      metadata: this.nuevoProfesor.metadata
    };

    // Verificar si ya existe un profesor con los mismos datos
    const existe = this.profesores.some(p =>
      p.nombre === this.nuevoProfesor.nombre &&
      p.apellidos === this.nuevoProfesor.apellidos &&
      JSON.stringify(p.materias) === JSON.stringify(this.nuevoProfesor.materias) &&
      JSON.stringify(p.metadata) === JSON.stringify(this.nuevoProfesor.metadata)
    );
    if (existe) {
      alert('No hay cambios en los datos del profesor. No se enviará la petición.');
      return;
    }

    try {
      const res = await fetch('https://horarios-backend-58w8.onrender.com/profesores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Error al crear el profesor');
      const data = await res.json();
      // Usar el id real devuelto por el backend
      this.profesores.push({ ...this.nuevoProfesor, profesor_id: data.profesor_id });
      this.nuevoProfesor = { profesor_id: '', nombre: '', apellidos: '', materias: [], metadata: {} };
    } catch (err) {
      alert('No se pudo crear el profesor: ' + err);
    }
  }

  async guardarEdicion() {
    if (!this.nuevoProfesor.nombre.trim()) return;
    if (!this.editandoId) return;

    // Usar los campos tal cual del formulario
    const body: any = {
      nombre: this.nuevoProfesor.nombre.trim(),
      apellidos: this.nuevoProfesor.apellidos.trim(),
      materias: this.nuevoProfesor.materias,
      metadata: this.nuevoProfesor.metadata
    };

    try {
      const res = await fetch(`https://horarios-backend-58w8.onrender.com/profesores/${this.editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Error al actualizar el profesor');
      const data = await res.json();
      // Mantener el id al actualizar localmente
      this.profesores = this.profesores.map(p =>
        p.profesor_id === this.editandoId ? { ...p, ...body, profesor_id: p.profesor_id } : p
      );
      this.nuevoProfesor = { profesor_id: '', nombre: '', apellidos: '', materias: [], metadata: {} };
      this.editandoId = null;
      //recagar la lista de profesores para asegurar consistencia
      this.cargarProfesores();
    } catch (err) {
      alert('No se pudo actualizar el profesor: ' + err);
    }
  }

  async eliminarProfesor(profesor_id: string) {
    const confirmacion = confirm('¿Estás seguro de que deseas eliminar este profesor?');
    if (!confirmacion) return;
    try {
      const res = await fetch(`https://horarios-backend-58w8.onrender.com/profesores/${profesor_id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Error al eliminar el profesor');
      this.profesores = this.profesores.filter(p => p.profesor_id !== profesor_id);
    } catch (err) {
      alert('No se pudo eliminar el profesor: ' + err);
      console.log(profesor_id);
    }
  }

  editarProfesor(profesor: any) {
    this.editandoId = profesor.profesor_id;
    this.nuevoProfesor = { ...profesor };
    // Mover la vista hacia el formulario de edición, pero con un offset para que se vea completo
    const formElement = document.getElementById('profesorForm');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Esperar un poco para que el scroll termine y luego ajustar hacia arriba
      setTimeout(() => {
        window.scrollBy({ top: -170, left: 0, behavior: 'smooth' }); // Ajusta el offset según la altura de tu navbar
      }, 400);
    }
  }

  cancelarEdicion() {
    this.nuevoProfesor = { profesor_id: '', nombre: '', apellidos: '', materias: [], metadata: {} };
    this.editandoId = null;
  }
}
