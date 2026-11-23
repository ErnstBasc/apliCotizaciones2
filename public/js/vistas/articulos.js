// Sección "Análisis y perspectivas": tarjetas con título y resumen (públicos) y lectura completa para premium.
// Mostrar u ocultar el botón "Leer" es solo comodidad: quien decide es el servidor (403 si la cuenta no es premium).
// El texto llega como párrafos de texto plano y se inserta con textContent (vía el()): nunca se interpreta como HTML.
import { obtener } from '../api.js';
import { el, reemplazar, bloqueError } from '../dom.js';
import { fechaLarga } from '../formato.js';
import { abrirCuenta, usuarioActual } from './cuenta.js';

const $ = (id) => document.getElementById(id);
// Fecha 'AAAA-MM-DD' en hora de Bolivia (UTC-4 todo el año)
const fechaBolivia = (instante) => new Date(instante.getTime() - 4 * 3600_000).toISOString().slice(0, 10);

function puedeLeer(lectores) {
  const u = usuarioActual();
  return Boolean(u && lectores.includes(u.rol));
}

function pie(lectores, alLeer) {
  if (puedeLeer(lectores)) return el('button', { type: 'button', class: 'boton boton-suave', onclick: alLeer }, 'Leer artículo');
  const u = usuarioActual();
  if (!u) {
    return el('p', { class: 'candado' }, el('span', { 'aria-hidden': 'true' }, '🔒 '), 'Para suscriptores premium. ',
      el('button', { type: 'button', class: 'boton-texto', onclick: abrirCuenta }, 'Ingresar'));
  }
  return el('p', { class: 'candado' }, el('span', { 'aria-hidden': 'true' }, '🔒 '), 'Tu cuenta no es premium: solo puedes ver el resumen.');
}

function tarjeta(a, lectores, alLeer) {
  return el('article', { class: 'articulo-tarjeta' },
    el('p', { class: 'articulo-insignia' }, 'Premium'),
    el('h3', {}, a.titulo),
    el('p', { class: 'articulo-meta' }, `${a.autor} · ${fechaLarga(fechaBolivia(new Date(a.publicadoEn)))}`),
    el('p', { class: 'articulo-resumen' }, a.resumen),
    pie(lectores, () => alLeer(a)));
}

export function iniciarArticulos() {
  const contenedor = $('articulos-contenido');
  const dialogo = $('dialogo-articulo');
  const cuerpo = $('articulo-contenido');
  let lista = null;

  async function leer(resumen) {
    $('articulo-titulo').textContent = resumen.titulo;
    reemplazar(cuerpo, el('p', { class: 'cargando' }, 'Cargando…'));
    if (!dialogo.open) dialogo.showModal();
    try {
      const { articulo } = await obtener(`/articulos/${resumen.id}`);
      reemplazar(cuerpo,
        el('p', { class: 'articulo-meta' }, `${articulo.autor} · ${fechaLarga(fechaBolivia(new Date(articulo.publicadoEn)))}`),
        el('div', { class: 'articulo-texto' }, articulo.parrafos.map((p) => el('p', {}, p))));
    } catch (error) {
      reemplazar(cuerpo, el('p', { class: 'error-campo', role: 'alert' }, error.message)); // por ejemplo: "Contenido para suscriptores premium"
    }
  }

  function pintar() {
    if (!lista) return;
    if (!lista.articulos.length) { reemplazar(contenedor, el('p', { class: 'nota' }, 'Todavía no hay artículos publicados.')); return; }
    reemplazar(contenedor, el('div', { class: 'rejilla-articulos' }, lista.articulos.map((a) => tarjeta(a, lista.lectores, leer))));
  }

  async function cargar() {
    try { lista = await obtener('/articulos'); pintar(); } catch (error) { reemplazar(contenedor, bloqueError(error.message, cargar)); }
  }

  $('articulo-cerrar').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); }); // clic fuera del cuadro
  document.addEventListener('sesion-cambiada', () => { if (dialogo.open && !puedeLeer(lista ? lista.lectores : [])) dialogo.close(); pintar(); });
  cargar();
}
