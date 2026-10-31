// Ruta del histórico: GET /historico?serie=oficial|paralelo|ambos&dias=7|30|90|180
const { validarHistorico } = require('./validacion');

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

function crearRutasHistorico(express, historico) {
  const router = express.Router();
  router.get('/historico', manejadorHistorico(historico));
  return router;
}

module.exports = { crearRutasHistorico, manejadorHistorico };
