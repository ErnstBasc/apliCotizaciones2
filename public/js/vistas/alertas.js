// Sección "Mis alertas": avisos por correo cuando el dólar oficial o paralelo cumple una condición.
// Según la sesión muestra una invitación (sin cuenta), un aviso (correo sin confirmar) o el administrador de alertas.
// Las reglas (límites, quién puede qué) las impone el servidor; aquí solo se arma la interfaz.
import { obtener, enviar } from '../api.js';
import { el, reemplazar, bloqueError } from '../dom.js';
import { abrirCuenta, usuarioActual } from './cuenta.js';

const $ = (id) => document.getElementById(id);
const TIPOS = [['sube_de', 'Sube de (Bs)'], ['baja_de', 'Baja de (Bs)'], ['cambio_pct', 'Cambia más de (%) en un día']];

function formularioNueva(alCrear) {
  const serie = el('select', { id: 'alerta-serie', name: 'serie' }, el('option', { value: 'paralelo' }, 'Paralelo'), el('option', { value: 'oficial' }, 'Oficial'));
  const lado = el('select', { id: 'alerta-lado', name: 'lado' }, el('option', { value: 'venta' }, 'Venta (lo que pagas)'), el('option', { value: 'compra' }, 'Compra (lo que recibes)'));
  const tipo = el('select', { id: 'alerta-tipo', name: 'tipo' }, TIPOS.map(([v, t]) => el('option', { value: v }, t)));
  const umbral = el('input', { id: 'alerta-umbral', name: 'umbral', inputmode: 'decimal', autocomplete: 'off', placeholder: 'Ej.: 12,50', required: true });
  const error = el('p', { class: 'error-campo', role: 'alert' });
  const boton = el('button', { type: 'submit', class: 'boton boton-principal' }, 'Crear alerta');
  const campoLado = el('div', { class: 'campo' }, el('label', { for: 'alerta-lado' }, 'Precio'), lado);

  const actualizar = () => { campoLado.hidden = serie.value === 'oficial'; }; // el oficial tiene un solo valor
  serie.addEventListener('change', actualizar);
  actualizar();

  const f = el('form', { class: 'formulario formulario-alerta' },
    el('div', { class: 'campo' }, el('label', { for: 'alerta-serie' }, 'Dólar'), serie),
    campoLado,
    el('div', { class: 'campo' }, el('label', { for: 'alerta-tipo' }, 'Avísame cuando'), tipo),
    el('div', { class: 'campo' }, el('label', { for: 'alerta-umbral' }, 'Valor'), umbral),
    error, boton);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    const numero = Number(umbral.value.trim().replace(',', '.'));
    if (!umbral.value.trim() || !Number.isFinite(numero)) { error.textContent = 'Escribe un número, por ejemplo 12,50.'; return; }
    boton.disabled = true;
    try {
      await enviar('/alertas', { serie: serie.value, lado: lado.value, tipo: tipo.value, umbral: numero });
      await alCrear();
    } catch (err) {
      error.textContent = err.message;
    } finally {
      boton.disabled = false;
    }
  });
  return f;
}

function filaAlerta(a, alCambiar) {
  const aviso = a.ultimoAviso ? `Último aviso: ${new Date(a.ultimoAviso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Aún sin avisos';
  const problema = el('span', { class: 'error-campo', role: 'alert' });
  const accion = (texto, clase, fn) => el('button', {
    type: 'button', class: `boton boton-suave ${clase}`,
    onclick: async (e) => {
      const boton = e.currentTarget;
      boton.disabled = true;
      problema.textContent = '';
      try { await fn(); await alCambiar(); } catch (err) { problema.textContent = err.message; boton.disabled = false; }
    },
  }, texto);
  return el('li', { class: `alerta-fila${a.activa ? '' : ' alerta-pausada'}` },
    el('div', { class: 'alerta-texto' },
      el('strong', {}, a.descripcion),
      el('span', { class: 'alerta-meta' }, `${a.activa ? 'Activa' : 'Pausada'} · ${aviso}`),
      problema),
    el('div', { class: 'alerta-acciones' },
      accion(a.activa ? 'Pausar' : 'Reanudar', '', () => enviar(`/alertas/${a.id}`, { activa: !a.activa }, 'PATCH')),
      accion('Eliminar', 'boton-peligro-suave', () => enviar(`/alertas/${a.id}`, undefined, 'DELETE'))));
}

export function iniciarAlertas() {
  const contenedor = $('alertas-contenido');
  let pintando = 0;

  async function pintar() {
    const u = usuarioActual();
    const turno = ++pintando; // si la sesión cambia mientras se carga, gana la última
    if (!u) {
      return reemplazar(contenedor,
        el('p', { class: 'dialogo-texto' }, 'Crea una cuenta gratuita para recibir un correo cuando el dólar llegue al precio que te interesa.'),
        el('button', { type: 'button', class: 'boton boton-suave', onclick: abrirCuenta }, 'Ingresar o crear cuenta'));
    }
    if (!u.verificado) {
      return reemplazar(contenedor,
        el('p', { class: 'dialogo-texto' }, 'Confirma tu correo para crear alertas. Te enviamos un enlace al registrarte; puedes pedir otro desde tu cuenta.'),
        el('button', { type: 'button', class: 'boton boton-suave', onclick: abrirCuenta }, 'Abrir mi cuenta'));
    }
    try {
      const datos = await obtener('/alertas');
      if (turno !== pintando) return;
      const lleno = datos.alertas.length >= datos.maximo;
      reemplazar(contenedor,
        el('p', { class: 'dialogo-texto' }, `Tienes ${datos.alertas.length} de ${datos.maximo} alertas. Cada alerta espera ${datos.enfriamientoHoras} horas antes de volver a avisarte.`),
        datos.alertas.length ? el('ul', { class: 'lista-alertas' }, datos.alertas.map((a) => filaAlerta(a, pintar))) : null,
        lleno ? el('p', { class: 'aviso-pendiente' }, 'Llegaste al máximo. Elimina una alerta para crear otra.') : formularioNueva(pintar));
    } catch (error) {
      if (turno === pintando) reemplazar(contenedor, bloqueError(error.message, pintar));
    }
  }

  document.addEventListener('sesion-cambiada', pintar);
}
