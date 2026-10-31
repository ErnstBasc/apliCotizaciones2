// Gráfico de evolución diaria del dólar oficial y paralelo (Chart.js, cargado desde la página).
// Dos selectores (qué dólar y qué período) piden /historico; los días sin datos quedan como huecos, nunca se inventan.
import { obtener } from '../api.js';
import { bs, porcentaje, fechaCorta, fechaLarga } from '../formato.js';

const $ = (id) => document.getElementById(id);
const valorDe = (nombre) => document.querySelector(`input[name="${nombre}"]:checked`).value;
const variable = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NOMBRES = { oficial: 'Oficial', paralelo: 'Paralelo' };

// Todas las fechas AAAA-MM-DD entre dos fechas, ambas incluidas
function fechasEntre(desde, hasta) {
  const fechas = [];
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += 86_400_000) {
    fechas.push(new Date(t).toISOString().slice(0, 10));
  }
  return fechas;
}

// Frase para quien no ve el gráfico (y resumen para todos): de cuánto a cuánto fue cada serie
export function resumirSeries(datos) {
  const frases = [];
  for (const [nombre, puntos] of Object.entries(datos.series)) {
    if (puntos.length === 0) { frases.push(`${NOMBRES[nombre]}: sin datos en este período.`); continue; }
    const primero = puntos[0];
    const ultimo = puntos[puntos.length - 1];
    const cambio = primero.venta === ultimo.venta ? 'sin cambios' : porcentaje((ultimo.venta / primero.venta - 1) * 100, true);
    const rotulo = nombre === 'paralelo' ? 'Paralelo (venta)' : 'Oficial';
    frases.push(`${rotulo}: de ${bs(primero.venta)} (${fechaCorta(primero.fecha)}) a ${bs(ultimo.venta)} (${fechaCorta(ultimo.fecha)}), ${cambio}.`);
  }
  return frases.join(' ');
}

export function iniciarHistorico() {
  const lienzo = $('grafico-historico');
  const resumen = $('resumen-historico');
  let grafico = null;
  let ultimosDatos = null;

  function dibujar(datos) {
    const texto = resumirSeries(datos);
    resumen.textContent = texto;
    lienzo.setAttribute('aria-label', `Gráfico de la evolución diaria del dólar. ${texto}`);
    if (!window.Chart) {
      resumen.textContent = `No se pudo cargar la librería del gráfico (¿sin conexión a internet?). ${texto}`;
      return;
    }
    const fechas = fechasEntre(datos.desde, datos.hasta);
    const colores = { oficial: variable('--serie-oficial'), paralelo: variable('--serie-paralelo') };
    const suave = variable('--tinta-suave');
    const compras = {};
    const conjuntos = Object.entries(datos.series).map(([nombre, puntos]) => {
      const porFecha = new Map(puntos.map((p) => [p.fecha, p]));
      compras[nombre] = fechas.map((f) => porFecha.get(f)?.compra ?? null);
      return {
        label: nombre === 'paralelo' ? 'Paralelo (venta)' : 'Oficial',
        nombre,
        data: fechas.map((f) => porFecha.get(f)?.venta ?? null),
        borderColor: colores[nombre],
        backgroundColor: colores[nombre],
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: true,        // une los puntos aunque falten días entre ellos
        stepped: nombre === 'oficial' ? 'before' : false, // el oficial cambia por escalones, no de forma suave
        tension: nombre === 'paralelo' ? 0.25 : 0,
      };
    });

    if (grafico) grafico.destroy();
    grafico = new window.Chart(lienzo, {
      type: 'line',
      data: { labels: fechas, datasets: conjuntos },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: sinMovimiento() ? false : { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: conjuntos.length > 1, labels: { color: suave, usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            callbacks: {
              title: (items) => fechaLarga(items[0].label),
              label: (c) => {
                const compra = compras[c.dataset.nombre]?.[c.dataIndex];
                const base = `${c.dataset.label}: ${bs(c.parsed.y)}`;
                return c.dataset.nombre === 'paralelo' && compra !== null ? `${base} · compra ${bs(compra)}` : base;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: suave, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, callback(valor) { return fechaCorta(this.getLabelForValue(valor)); } } },
          y: { grid: { color: variable('--linea') }, ticks: { color: suave, callback: (v) => bs(v) } },
        },
      },
    });
  }

  async function cargar() {
    try {
      ultimosDatos = await obtener(`/historico?serie=${valorDe('serie')}&dias=${valorDe('rango')}`);
      dibujar(ultimosDatos);
      return true;
    } catch (error) {
      resumen.textContent = `No se pudo cargar el gráfico. ${error.message}`;
      return false;
    }
  }

  for (const id of ['selector-serie', 'selector-rango']) $(id).addEventListener('change', cargar);
  // Al cambiar entre modo claro y oscuro hay que redibujar: los colores del gráfico se leen al crearlo
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (ultimosDatos) dibujar(ultimosDatos); });
  return cargar;
}
