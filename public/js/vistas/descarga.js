// Botón "Descargar CSV" bajo el gráfico. Pide al servidor los MISMOS datos que muestra el gráfico (serie y período elegidos).
// El servidor decide quién puede descargar (sesión + correo confirmado); aquí solo se orienta a la persona.
import { descargar } from '../api.js';
import { abrirCuenta, usuarioActual } from './cuenta.js';

const $ = (id) => document.getElementById(id);
const valorDe = (nombre) => document.querySelector(`input[name="${nombre}"]:checked`).value;

export function iniciarDescarga() {
  const estado = $('estado-csv');
  const boton = $('btn-csv');

  function orientar() {
    const u = usuarioActual();
    estado.textContent = !u ? 'Para descargar los datos, ingresa o crea una cuenta gratuita.'
      : !u.verificado ? 'Confirma tu correo para poder descargar los datos.' : '';
  }
  document.addEventListener('sesion-cambiada', orientar);

  boton.addEventListener('click', async () => {
    const u = usuarioActual();
    if (!u || !u.verificado) { orientar(); abrirCuenta(); return; }
    boton.disabled = true;
    estado.textContent = 'Preparando el archivo…';
    try {
      const { blob, nombre } = await descargar(`/historico.csv?serie=${valorDe('serie')}&dias=${valorDe('rango')}&formato=${$('formato-csv').value}`);
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(blob);
      enlace.download = nombre;
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000);
      estado.textContent = `Descargado: ${nombre}`;
    } catch (e) {
      estado.textContent = `No se pudo descargar. ${e.message}`;
    } finally {
      boton.disabled = false;
    }
  });
}
