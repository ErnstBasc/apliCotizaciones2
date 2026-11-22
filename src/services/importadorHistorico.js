// Importación de histórico REAL desde las series públicas de dolarbluebolivia.click.
// Aquí solo hay funciones PURAS (sin red ni base de datos): convierten la respuesta de la API en lecturas
// diarias y deciden qué días faltan. El script scripts/importarHistorico.js se encarga de pedir y guardar.
//
// Reglas:
//   - Un valor por día (hora de Bolivia): el ÚLTIMO del día, igual que el gráfico.
//   - Solo se rellenan días VACÍOS de esa serie: nunca se pisa lo que ya guardó el recolector.
//   - Hoy no se importa (de hoy se encarga el recolector en vivo).
//   - Control de cordura: valores fuera de 1–100 Bs se descartan.
//   - En la API, "buy" = lo que recibes al vender (nuestra compra) y "sell" = lo que pagas (nuestra venta);
//     en la serie de 6 meses: bb/bs = paralelo (compra/venta), ob/os = oficial.
const { fechaBolivia } = require('../utilidades/fechas');
const { SERIES } = require('../dominio/historico');

const FUENTE_IMPORTADA = 'dolarblue_historico';
const RUTAS = { oficial: '/v1/chart/oficial', paralelo: '/v1/chart/6m' };
const CAMPOS = {
  oficial: { venta: ['sell', 'os'], compra: ['buy', 'ob'] },
  paralelo: { venta: ['bs'], compra: ['bb'] },
};

const valido = (x) => typeof x === 'number' && Number.isFinite(x) && x > 1 && x < 100;
const primero = (obj, nombres) => nombres.map((n) => obj[n]).map((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v)).find(valido);

// La respuesta puede venir como arreglo o envuelta ({ data: [...] }, { data: { points: [...] } }…)
function extraerPuntos(json) {
  const candidatos = [json, json && json.data, json && json.points, json && json.data && json.data.points, json && json.data && json.data.series];
  const lista = candidatos.find(Array.isArray);
  if (!lista) throw new Error('La respuesta no contiene una lista de puntos (formato inesperado: revisar con --explorar)');
  return lista;
}

// Momento de un punto: "t" (segundos o milisegundos) o una fecha "d"/"fecha"/"date" (AAAA-MM-DD → mediodía de Bolivia)
function instanteDe(p) {
  const t = p.t ?? p.timestamp ?? p.time;
  if (typeof t === 'number' && t > 0) return new Date(t < 1e12 ? t * 1000 : t);
  if (typeof t === 'string' && !Number.isNaN(Date.parse(t))) return new Date(t);
  const d = p.d ?? p.fecha ?? p.date;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return new Date(`${d.slice(0, 10)}T16:00:00Z`); // 12:00 en La Paz
  return null;
}

// Convierte la respuesta de una serie en lecturas { serie, instante, dia, venta, compra }. Devuelve también los descartes.
function convertir(serie, json) {
  const campos = CAMPOS[serie];
  if (!campos) throw new Error(`Serie desconocida: ${serie}`);
  const lecturas = [];
  let descartados = 0;
  for (const p of extraerPuntos(json)) {
    const instante = p && typeof p === 'object' ? instanteDe(p) : null;
    const venta = instante ? primero(p, campos.venta) : undefined;
    if (!instante || Number.isNaN(instante.getTime()) || venta === undefined) { descartados += 1; continue; }
    const compra = primero(p, campos.compra);
    lecturas.push({ serie, instante, dia: fechaBolivia(instante), venta, compra: compra ?? venta });
  }
  return { lecturas, descartados };
}

// Deja la ÚLTIMA lectura de cada día
function ultimoPorDia(lecturas) {
  const porDia = new Map();
  for (const l of lecturas) {
    const actual = porDia.get(l.dia);
    if (!actual || l.instante > actual.instante) porDia.set(l.dia, l);
  }
  return [...porDia.values()].sort((a, b) => a.instante - b.instante);
}

// Decide qué guardar: un valor por día, sin hoy y sin los días que ya tienen datos de esa serie.
function planificar({ serie, lecturas, diasOcupados, ahora = new Date() }) {
  const hoy = fechaBolivia(ahora);
  const ocupados = new Set(diasOcupados);
  const diarias = ultimoPorDia(lecturas);
  const nuevas = diarias.filter((l) => l.dia < hoy && !ocupados.has(l.dia));
  const { instrumento, entidad } = SERIES[serie];
  return {
    filas: nuevas.map((l) => ({
      instrumento, entidad,
      valor: l.venta, venta: l.venta, compra: l.compra,
      fecha: l.dia, obtenidoEn: l.instante,
    })),
    dias: diarias.length,
    yaExistian: diarias.filter((l) => ocupados.has(l.dia)).length,
    desde: nuevas[0]?.dia ?? null,
    hasta: nuevas.at(-1)?.dia ?? null,
  };
}

module.exports = { FUENTE_IMPORTADA, RUTAS, extraerPuntos, instanteDe, convertir, ultimoPorDia, planificar };
