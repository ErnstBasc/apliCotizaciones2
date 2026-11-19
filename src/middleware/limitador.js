// Límite de peticiones: "como mucho N peticiones por ventana de tiempo para cada clave" (normalmente la IP).
// Hecho a mano, sin dependencias: ventana fija con un contador por clave, guardado en la memoria del proceso.
//   - Protege contra fuerza bruta (probar contraseñas), correo masivo (registro/recuperación) y abuso general.
//   - Al excederse responde 429 con la cabecera Retry-After (segundos para volver a intentar).
//   - Limitación honesta: los contadores viven en la memoria de ESTE proceso; si se reinicia, se borran, y con varias copias
//     del servidor cada una cuenta aparte. Para varias copias haría falta un almacén común (por ejemplo Redis).
const { ErrorApp } = require('../errores');

const MAX_CLAVES = 10_000; // tope de memoria: nunca se guardan más contadores que esto

function crearLimitador({ ventanaMs, maximo, clave = (req) => req.ip, mensaje = 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo', reloj = () => Date.now() }) {
  const contadores = new Map(); // clave → { inicio, cuenta }

  function limpiar(ahora) {
    for (const [k, c] of contadores) if (ahora - c.inicio >= ventanaMs) contadores.delete(k);
    // Si aun así hay demasiadas claves (ataque con miles de IPs distintas), se descartan las más antiguas
    for (const k of contadores.keys()) { if (contadores.size <= MAX_CLAVES * 0.9) break; contadores.delete(k); }
  }

  function limitador(req, res, next) {
    const k = clave(req);
    if (!k) return next(); // sin clave (por ejemplo, petición sin correo): lo decide la validación, no el límite
    const ahora = reloj();
    if (contadores.size >= MAX_CLAVES) limpiar(ahora);
    let c = contadores.get(k);
    if (!c || ahora - c.inicio >= ventanaMs) { c = { inicio: ahora, cuenta: 0 }; contadores.set(k, c); }
    c.cuenta += 1;
    const restante = Math.max(0, maximo - c.cuenta);
    const reinicioS = Math.ceil((c.inicio + ventanaMs - ahora) / 1000);
    res.setHeader('RateLimit-Limit', String(maximo));
    res.setHeader('RateLimit-Remaining', String(restante));
    res.setHeader('RateLimit-Reset', String(reinicioS));
    if (c.cuenta > maximo) {
      res.setHeader('Retry-After', String(reinicioS));
      return next(new ErrorApp(429, mensaje));
    }
    return next();
  }
  limitador.tamano = () => contadores.size; // para pruebas
  return limitador;
}

// Cuántas peticiones y en qué tiempo, por tipo de ruta. Valores pensados para uso humano normal.
const MIN = 60_000; const HORA = 60 * MIN;
const LIMITES = {
  general:    { ventanaMs: MIN,       maximo: 120, mensaje: 'Demasiadas peticiones. Espera un minuto' },
  ingreso:    { ventanaMs: 15 * MIN,  maximo: 10,  mensaje: 'Demasiados intentos de ingreso. Espera unos minutos' },
  correos:    { ventanaMs: HORA,      maximo: 5,   mensaje: 'Demasiadas solicitudes de correo desde tu conexión. Inténtalo más tarde' },
  porCorreo:  { ventanaMs: HORA,      maximo: 3,   mensaje: 'Ya se enviaron varios mensajes a ese correo. Inténtalo más tarde' },
  enlaces:    { ventanaMs: HORA,      maximo: 20,  mensaje: 'Demasiados intentos. Inténtalo más tarde' },
  descargas:  { ventanaMs: HORA,      maximo: 30,  mensaje: 'Demasiadas descargas. Inténtalo más tarde' },
};

// Arma todos los limitadores de la aplicación. Si `activo` es false devuelve null (sin límites: solo para desarrollo y pruebas).
function crearLimitadores({ activo = true, reloj } = {}) {
  if (!activo) return null;
  const mk = (cfg, extra = {}) => crearLimitador({ ...cfg, ...extra, reloj });
  const correoDelCuerpo = (req) => {
    const c = req.body && req.body.correo;
    return typeof c === 'string' && c ? c.trim().toLowerCase().slice(0, 254) : null;
  };
  return {
    general: mk(LIMITES.general),
    ingreso: mk(LIMITES.ingreso),
    correos: mk(LIMITES.correos),                                     // por IP: registro, recuperación, reenvío
    porCorreo: mk(LIMITES.porCorreo, { clave: correoDelCuerpo }),     // por destinatario: evita "bombardear" a una persona desde muchas IPs
    enlaces: mk(LIMITES.enlaces),                                     // verificar y restablecer (códigos de los correos)
    descargas: mk(LIMITES.descargas),
  };
}

module.exports = { crearLimitador, crearLimitadores, LIMITES };
