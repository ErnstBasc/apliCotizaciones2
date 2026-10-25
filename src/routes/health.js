// GET /health: ¿el servicio está vivo y la base responde?
const { ErrorApp } = require('../errores');

// El manejador es una función pura de (repositorio): se puede probar sin Express.
function manejadorHealth(repositorio) {
  return async (req, res, next) => {
    try {
      const instrumentos = await repositorio.contarInstrumentos();
      res.json({ estado: 'ok', base_de_datos: 'conectada', instrumentos });
    } catch (err) {
      next(new ErrorApp(503, 'La base de datos no está disponible', err.message));
    }
  };
}

function crearRutaHealth(express, repositorio) {
  const router = express.Router();
  router.get('/', manejadorHealth(repositorio));
  return router;
}

module.exports = { crearRutaHealth, manejadorHealth };
