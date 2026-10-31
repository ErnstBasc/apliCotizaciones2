// Dos guardias para las rutas:
//   exigirSesion     → hay que haber ingresado (cookie válida y usuario vigente). Deja el usuario en req.usuario.
//   exigirVerificado → además, el correo debe estar confirmado (lo usarán CSV y alertas).
//   mismoOrigen      → defensa contra CSRF para peticiones que modifican datos.
const { ErrorApp } = require('../errores');

function crearAutenticacion({ sesiones, usuarios }) {
  async function exigirSesion(req, res, next) {
    try {
      const usuario = await usuarios.deSesion(sesiones.leer(req));
      if (!usuario) {
        sesiones.limpiar(res); // cookie vencida, alterada o de una sesión ya invalidada
        throw new ErrorApp(401, 'Inicia sesión para continuar');
      }
      req.usuario = usuario;
      next();
    } catch (err) { next(err); }
  }

  function exigirVerificado(req, res, next) {
    if (!req.usuario) return next(new ErrorApp(401, 'Inicia sesión para continuar'));
    if (!req.usuario.verificado) return next(new ErrorApp(403, 'Confirma tu correo para usar esta función'));
    return next();
  }

  return { exigirSesion, exigirVerificado };
}

// CSRF: un sitio malicioso puede hacer que TU navegador envíe una petición a esta API con tu cookie.
// Defensas en capas: la cookie es SameSite=Strict (el navegador ya no la manda desde otros sitios) y, además,
// las peticiones que modifican datos deben venir del mismo origen. Los navegadores siempre envían Origin en esos casos;
// curl o Postman no lo envían y se aceptan (no hay una cookie ajena que abusar).
function mismoOrigen(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origen = req.headers && req.headers.origin;
  if (!origen) return next();
  let host = null;
  try { host = new URL(origen).host; } catch { /* origen ilegible: se rechaza */ }
  if (host && host === req.headers.host) return next();
  return next(new ErrorApp(403, 'Origen no permitido'));
}

module.exports = { crearAutenticacion, mismoOrigen };
