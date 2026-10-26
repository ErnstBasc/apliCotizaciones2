// Rutas de cálculos: GET /cotizaciones, GET /convertir, GET /comparacion
const { validarConversion } = require('./validacion');

const manejadorResumen = (calculos) => async (req, res, next) => {
  try { res.json(await calculos.resumen()); } catch (err) { next(err); }
};

const manejadorConvertir = (calculos) => async (req, res, next) => {
  try {
    const consulta = validarConversion(req.query); // lanza ErrorValidacion (400) si algo no cuadra
    res.json(await calculos.convertir(consulta));
  } catch (err) { next(err); }
};

const manejadorComparacion = (calculos) => async (req, res, next) => {
  try { res.json(await calculos.comparacion()); } catch (err) { next(err); }
};

function crearRutasCalculos(express, calculos) {
  const router = express.Router();
  router.get('/cotizaciones', manejadorResumen(calculos));
  router.get('/convertir', manejadorConvertir(calculos));
  router.get('/comparacion', manejadorComparacion(calculos));
  return router;
}

module.exports = { crearRutasCalculos, manejadorResumen, manejadorConvertir, manejadorComparacion };
