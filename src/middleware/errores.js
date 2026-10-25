// Manejo centralizado de errores. Las rutas lanzan errores y ESTE archivo decide qué ve el cliente.
// Regla de seguridad: los errores inesperados NUNCA filtran su mensaje (rutas, SQL, contraseñas…).
const { ErrorApp, ErrorNoEncontrado } = require('../errores');

function noEncontrado(req, res, next) {
  next(new ErrorNoEncontrado());
}

function manejarErrores(logger = console) {
  // Express reconoce un manejador de errores por tener exactamente 4 parámetros.
  // eslint-disable-next-line no-unused-vars
  return function (err, req, res, next) {
    if (res.headersSent) return next(err);

    if (err instanceof ErrorApp) {
      if (err.interno) logger.error(`[${err.name}] ${err.message} · detalle interno: ${err.interno}`);
      return res.status(err.estado).json({ estado: 'error', mensaje: err.message });
    }

    // JSON mal formado en el cuerpo (lo lanza express.json())
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ estado: 'error', mensaje: 'El cuerpo de la petición no es JSON válido' });
    }

    logger.error('[error inesperado]', err);
    return res.status(500).json({ estado: 'error', mensaje: 'Error interno del servidor' });
  };
}

module.exports = { noEncontrado, manejarErrores };
