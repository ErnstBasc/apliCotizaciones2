// Rutas de lectura de fuentes: GET /monedas, /oficial, /paralelo e /indicadores
const { presentarCotizacion } = require('./presentadores');

const manejadorMonedas = (servicio) => async (req, res, next) => {
  try {
    const r = await servicio.monedas();
    res.json({
      base: 'USD',
      origen: r.origen,
      desactualizado: r.desactualizado,
      monedas: r.observaciones.map(presentarCotizacion),
    });
  } catch (err) { next(err); }
};

const manejadorOficial = (servicio) => async (req, res, next) => {
  try {
    const r = await servicio.oficial();
    res.json({
      base: 'USD',
      cotizada: 'BOB',
      origen: r.origen,
      desactualizado: r.desactualizado,
      oficial: presentarCotizacion(r.observaciones[0]),
    });
  } catch (err) { next(err); }
};

const manejadorIndicadores = (servicio) => async (req, res, next) => {
  try {
    const r = await servicio.indicadores();
    const por = Object.fromEntries(r.observaciones.map((o) => [o.instrumento, presentarCotizacion(o)]));
    res.json({
      origen: r.origen,
      desactualizado: r.desactualizado,
      oro: por.ORO ?? null,
      ufv: por.UFV ?? null,
      inflacion: { mensual: por.INFLACION_MENSUAL ?? null, doce_meses: por.INFLACION_12M ?? null },
    });
  } catch (err) { next(err); }
};

const manejadorParalelo = (servicio) => async (req, res, next) => {
  try {
    const r = await servicio.paralelo();
    res.json({
      base: 'USD',
      cotizada: 'BOB',
      origen: r.origen,
      desactualizado: r.desactualizado,
      paralelo: presentarCotizacion(r.observaciones[0]),
    });
  } catch (err) { next(err); }
};

function crearRutasFuentes(express, servicio) {
  const router = express.Router();
  router.get('/monedas', manejadorMonedas(servicio));
  router.get('/oficial', manejadorOficial(servicio));
  router.get('/paralelo', manejadorParalelo(servicio));
  router.get('/indicadores', manejadorIndicadores(servicio));
  return router;
}

module.exports = { crearRutasFuentes, manejadorMonedas, manejadorOficial, manejadorIndicadores, manejadorParalelo };
