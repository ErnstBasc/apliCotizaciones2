// Ruta del histórico: GET /historico?serie=oficial|paralelo|ambos&dias=7|30|90|180
const { validarHistorico, validarExportacion } = require('./validacion');
const { aCsv } = require('../utilidades/csv');

// En cada punto la venta va primero y luego la compra, como en el resto de la API
const presentarPunto = (p) => ({ fecha: p.fecha, venta: p.venta ?? p.valor, compra: p.compra ?? p.valor });

const manejadorHistorico = (historico) => async (req, res, next) => {
  try {
    const consulta = validarHistorico(req.query); // lanza ErrorValidacion (400) si algo no cuadra
    const r = await historico.consultar(consulta);
    res.json({
      base: 'USD',
      cotizada: 'BOB',
      serie: consulta.serie,
      dias: r.dias,
      desde: r.desde,
      hasta: r.hasta,
      series: Object.fromEntries(Object.entries(r.series).map(([n, puntos]) => [n, puntos.map(presentarPunto)])),
      nota: 'Último valor de cada día (hora de Bolivia). Los días sin datos no aparecen.',
    });
  } catch (err) { next(err); }
};

// Una fila por día. Oficial: un solo valor diario. Paralelo: venta y luego compra (convención de toda la API).
// Si un día falta en una de las series, su celda queda vacía (no se inventa nada).
function filasCsv(series) {
  const columnas = [];
  if (series.oficial) columnas.push({ titulo: 'oficial_bs_por_usd', de: (p) => p.venta ?? p.valor, serie: 'oficial' });
  if (series.paralelo) {
    columnas.push({ titulo: 'paralelo_venta_bs_por_usd', de: (p) => p.venta ?? p.valor, serie: 'paralelo' });
    columnas.push({ titulo: 'paralelo_compra_bs_por_usd', de: (p) => p.compra ?? p.valor, serie: 'paralelo' });
  }
  const porDia = Object.fromEntries(Object.entries(series).map(([n, pts]) => [n, new Map(pts.map((p) => [p.fecha, p]))]));
  const fechas = [...new Set(Object.values(series).flat().map((p) => p.fecha))].sort();
  return {
    encabezados: ['fecha', ...columnas.map((c) => c.titulo)],
    filas: fechas.map((f) => [f, ...columnas.map((c) => { const p = porDia[c.serie].get(f); return p ? c.de(p) : null; })]),
  };
}

// GET /historico.csv — descarga. Las guardias (sesión + correo verificado) las pone quien monta la ruta.
const manejadorHistoricoCsv = (historico) => async (req, res, next) => {
  try {
    const { formato, ...consulta } = validarExportacion(req.query);
    const r = await historico.consultar(consulta);
    const { encabezados, filas } = filasCsv(r.series);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dolar-bolivia_${consulta.serie}_${r.desde}_${r.hasta}.csv"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(aCsv(encabezados, filas, formato));
  } catch (err) { next(err); }
};

// `guardias` = middlewares que protegen la descarga. Sin guardias NO se monta la ruta (falla cerrado, nunca abierto).
function crearRutasHistorico(express, historico, guardias) {
  const router = express.Router();
  router.get('/historico', manejadorHistorico(historico));
  if (guardias) router.get('/historico.csv', ...guardias, manejadorHistoricoCsv(historico));
  return router;
}

module.exports = { crearRutasHistorico, manejadorHistorico, manejadorHistoricoCsv, filasCsv };
