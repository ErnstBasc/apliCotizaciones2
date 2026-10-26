// Rutas del dólar en entidades: GET /billeteras y GET /bancos (venta primero, luego compra).
const { presentarCotizacion } = require('./presentadores');

const manejadorBilleteras = (servicio) => async (req, res, next) => {
  try {
    const r = await servicio.billeteras();
    res.json({
      base: 'USD',
      cotizada: 'BOB',
      origen: r.origen,
      desactualizado: r.desactualizado,
      billeteras: r.observaciones.map(presentarCotizacion),
    });
  } catch (err) { next(err); }
};

const manejadorBancos = (servicio) => async (req, res, next) => {
  try {
    const r = await servicio.bancos();
    res.json({
      base: 'USD',
      cotizada: 'BOB',
      origen: r.origen,
      desactualizado: r.desactualizado,
      resumen: r.resumen,
      aviso: 'Precios de pizarra publicados por cada banco en su web; pueden diferir de lo que cobra en ventanilla o app.',
      bancos: r.bancos.map(presentarCotizacion),
    });
  } catch (err) { next(err); }
};

function crearRutasEntidades(express, servicio) {
  const router = express.Router();
  router.get('/billeteras', manejadorBilleteras(servicio));
  router.get('/bancos', manejadorBancos(servicio));
  return router;
}

module.exports = { crearRutasEntidades, manejadorBilleteras, manejadorBancos };
