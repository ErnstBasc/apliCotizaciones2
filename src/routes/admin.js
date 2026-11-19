// Rutas del administrador: /admin. Todas exigen sesión Y rol de administrador (se aplican una vez, en el router).
// Son de solo lectura: el administrador observa totales, no modifica datos ni ve correos de otras personas.
const v = require('./validacion');

const manejadores = (estadisticas) => ({
  estadisticas: async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await estadisticas.resumen(v.validarEstadisticas(req.query)));
    } catch (e) { next(e); }
  },
});

function crearRutasAdmin(express, { estadisticas, autenticacion, mismoOrigen }) {
  const h = manejadores(estadisticas);
  const r = express.Router();
  r.use(mismoOrigen, autenticacion.exigirSesion, autenticacion.exigirAdmin);
  r.get('/estadisticas', h.estadisticas);
  return r;
}

module.exports = { crearRutasAdmin, manejadoresAdmin: manejadores };
