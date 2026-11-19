// Panel de administración: totales de usuarios, alertas, uso de la API y datos guardados.
// Aparece SOLO si la sesión es de un administrador. Eso es comodidad, no seguridad: quien manda es el servidor,
// que responde 403 en /admin/estadisticas a cualquiera que no tenga ese rol.
// Solo se muestran totales; el servidor no entrega correos ni datos de personas concretas.
import { obtener } from '../api.js';
import { el, reemplazar, bloqueError } from '../dom.js';
import { fechaCorta, fechaLarga } from '../formato.js';
import { usuarioActual } from './cuenta.js';

const $ = (id) => document.getElementById(id);
const entero = new Intl.NumberFormat('es-BO');
const variable = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PERIODOS = [['7', '7 días'], ['30', '30 días'], ['90', '90 días']];

function tarjeta(etiqueta, cifra, detalle) {
  return el('div', { class: 'stat' },
    el('span', { class: 'stat-etiqueta' }, etiqueta),
    el('strong', { class: 'stat-cifra' }, entero.format(cifra)),
    detalle ? el('span', { class: 'stat-detalle' }, detalle) : null);
}

function tablaRutas(rutas) {
  if (!rutas.length) return el('p', { class: 'nota' }, 'Todavía no hay peticiones medidas en este período.');
  return el('table', { class: 'tabla-precios tabla-rutas' },
    el('caption', { class: 'solo-lectores' }, 'Rutas más pedidas del período'),
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Ruta de la API'), el('th', { scope: 'col', class: 'num' }, 'Peticiones'))),
    el('tbody', {}, rutas.map((r) => el('tr', {}, el('th', { scope: 'row' }, r.ruta === '(otras)' ? 'Otras (no reconocidas)' : el('code', {}, r.ruta)), el('td', { class: 'num' }, entero.format(r.total))))));
}

export function resumirUso(d) {
  const picos = d.uso.porDia.filter((x) => x.peticiones > 0);
  if (!picos.length) return 'Sin peticiones medidas en este período.';
  const mayor = picos.reduce((a, b) => (b.peticiones > a.peticiones ? b : a));
  return `${entero.format(d.uso.peticiones)} peticiones en ${d.periodo.dias} días; el día con más fue el ${fechaLarga(mayor.fecha)} (${entero.format(mayor.peticiones)}).`;
}

export function iniciarAdmin() {
  const seccion = $('admin-seccion');
  const contenedor = $('admin-contenido');
  let grafico = null;
  let turno = 0;
  let dias = '30';
  let ultimo = null;

  const destruir = () => { if (grafico) { grafico.destroy(); grafico = null; } };

  function dibujar(lienzo, d) {
    destruir();
    if (!window.Chart) return;
    const suave = variable('--tinta-suave');
    grafico = new window.Chart(lienzo, {
      type: 'bar',
      data: {
        labels: d.uso.porDia.map((x) => x.fecha),
        datasets: [
          { label: 'Peticiones a la API', data: d.uso.porDia.map((x) => x.peticiones), backgroundColor: variable('--serie-oficial'), borderRadius: 3 },
          { label: 'Descargas de CSV', data: d.uso.porDia.map((x) => x.descargas), backgroundColor: variable('--serie-paralelo'), borderRadius: 3 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: sinMovimiento() ? false : { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: suave, usePointStyle: true, boxWidth: 8 } },
          tooltip: { callbacks: { title: (items) => fechaLarga(items[0].label) } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: suave, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, callback(v) { return fechaCorta(this.getLabelForValue(v)); } } },
          y: { beginAtZero: true, grid: { color: variable('--linea') }, ticks: { color: suave, precision: 0 } },
        },
      },
    });
  }

  function pintar(d) {
    ultimo = d;
    const u = d.usuarios; const a = d.alertas; const uso = d.uso;
    const selector = el('fieldset', { class: 'segmentado', id: 'selector-admin' },
      el('legend', { class: 'solo-lectores' }, 'Período de las estadísticas'),
      PERIODOS.map(([valor, texto]) => el('label', {}, el('input', { type: 'radio', name: 'admin-rango', value: valor, checked: valor === String(d.periodo.dias), onchange: () => { dias = valor; cargar(); } }), el('span', {}, texto))));
    const lienzo = el('canvas', { role: 'img', 'aria-label': `Peticiones por día. ${resumirUso(d)}` });
    const medido = uso.medidoDesde
      ? `El conteo de peticiones empezó el ${fechaLarga(uso.medidoDesde)}: los días anteriores aparecen en cero porque no se medían, no porque no hubiera uso.`
      : 'El conteo de peticiones aún no registró nada.';

    reemplazar(contenedor,
      el('div', { class: 'controles-grafico' },
        el('p', { class: 'nota nota-admin' }, `Del ${fechaLarga(d.periodo.desde)} al ${fechaLarga(d.periodo.hasta)} (hora de Bolivia).`),
        selector),
      el('div', { class: 'stats' },
        tarjeta('Personas registradas', u.total, `${entero.format(u.verificados)} con el correo confirmado`),
        tarjeta('Altas en el período', u.altasEnPeriodo, `Por rol: ${entero.format(u.porRol.registrado)} comunes · ${entero.format(u.porRol.premium)} premium · ${entero.format(u.porRol.admin)} admin`),
        tarjeta('Peticiones a la API', uso.peticiones, 'En el período, sin contar este panel'),
        tarjeta('Descargas de CSV', uso.descargas, 'Incluidas en las peticiones'),
        tarjeta('Alertas activas', a.activas, `${entero.format(a.total)} creadas en total`),
        tarjeta('Avisos enviados', a.avisosEnPeriodo, `${entero.format(a.avisosEnviados)} desde siempre`),
        tarjeta('Cotizaciones guardadas', d.datos.cotizaciones, d.datos.ultimaObtencion ? `Última lectura: ${new Date(d.datos.ultimaObtencion).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Aún sin lecturas')),
      el('h3', { class: 'subtitulo-admin' }, 'Peticiones por día'),
      el('div', { class: 'lienzo' }, lienzo),
      el('p', { class: 'nota', role: 'status' }, resumirUso(d)),
      el('p', { class: 'nota' }, medido),
      el('div', { class: 'rejilla-admin' },
        el('div', {}, el('h3', { class: 'subtitulo-admin' }, 'Rutas más pedidas'), tablaRutas(uso.rutas)),
        el('div', {}, el('h3', { class: 'subtitulo-admin' }, 'Lecturas guardadas por fuente'),
          d.datos.porFuente.length
            ? el('table', { class: 'tabla-precios tabla-rutas' },
              el('caption', { class: 'solo-lectores' }, 'Cotizaciones guardadas por fuente'),
              el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Fuente'), el('th', { scope: 'col', class: 'num' }, 'Lecturas'))),
              el('tbody', {}, d.datos.porFuente.map((f) => el('tr', {}, el('th', { scope: 'row' }, f.fuente), el('td', { class: 'num' }, entero.format(f.total))))))
            : el('p', { class: 'nota' }, 'Aún no hay lecturas guardadas.'))),
      el('p', { class: 'nota' }, 'Solo se muestran totales: este panel no incluye correos ni datos de personas concretas.'));
    if (!window.Chart) contenedor.querySelector('.lienzo').replaceChildren(el('p', { class: 'nota' }, 'No se pudo cargar la librería del gráfico (ver README: npm run vendor). Los totales de arriba siguen siendo válidos.'));
    else dibujar(lienzo, d);
  }

  async function cargar() {
    const mio = ++turno; // si la sesión cambia mientras se carga, gana la última
    try {
      const datos = await obtener(`/admin/estadisticas?dias=${dias}`);
      if (mio === turno) pintar(datos);
    } catch (error) {
      if (mio === turno) { destruir(); reemplazar(contenedor, bloqueError(error.message, cargar)); }
    }
  }

  function alCambiarSesion() {
    const u = usuarioActual();
    const esAdmin = Boolean(u && u.rol === 'admin');
    seccion.hidden = !esAdmin;
    if (!esAdmin) { turno += 1; destruir(); ultimo = null; reemplazar(contenedor); return; } // al salir no queda nada en pantalla
    reemplazar(contenedor, el('p', { class: 'cargando' }, 'Cargando…'));
    cargar();
  }

  document.addEventListener('sesion-cambiada', alCambiarSesion);
  // Al cambiar entre modo claro y oscuro hay que redibujar: los colores del gráfico se leen al crearlo
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (ultimo) pintar(ultimo); });
}
