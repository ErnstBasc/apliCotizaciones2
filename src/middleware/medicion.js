// Medidor de uso: cuenta cuántas peticiones a la API (y cuántas descargas de CSV) se atienden, por día y por ruta.
//   - Cuenta en MEMORIA y vuelca a PostgreSQL cada pocos segundos: así no se escribe en la base en cada petición.
//   - La ruta se clasifica contra la lista de rutas CONOCIDAS (las mismas de la documentación OpenAPI, por ejemplo
//     "/alertas/:id"): aunque alguien invente miles de direcciones, solo hay tantos contadores como rutas reales
//     (las desconocidas van a "(otras)"). Así también se clasifican bien las peticiones rechazadas (401, 400, 429).
//   - No guarda IP, correo ni nada de la persona: solo totales.
//   - Si la base falla, los contadores se conservan y se reintentan en el siguiente volcado.
const { fechaBolivia } = require('../utilidades/fechas');

const EXCLUIDAS = /^\/(admin|health)(\/|$)/; // el propio panel y el chequeo de salud no cuentan como "uso"
const RUTA_DESCARGA = '/historico.csv';

const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Convierte "/alertas/{id}" (formato OpenAPI) en { nombre: '/alertas/:id', regex }
function compilarRutas(rutas) {
  return rutas.map((r) => ({
    nombre: r.replace(/\{(\w+)\}/g, ':$1'),
    regex: new RegExp(`^${r.split(/\{\w+\}/).map(escapar).join('[^/]+')}/?$`),
  }));
}

function clasificar(direccion, patrones) {
  const ruta = String(direccion).split('?')[0];
  return patrones.find((p) => p.regex.test(ruta))?.nombre ?? '(otras)';
}

function crearMedidor({ repositorio, rutasConocidas = [], ahora = () => new Date(), cadaMs = 30_000, logger = console, programar = setInterval, cancelar = clearInterval }) {
  const patrones = compilarRutas(rutasConocidas);
  let pendiente = new Map(); // clave → { dia, tipo, ruta, total }
  let reloj = null;

  function sumar(dia, tipo, ruta, total = 1) {
    const clave = `${dia}\u0000${tipo}\u0000${ruta}`;
    const actual = pendiente.get(clave);
    if (actual) actual.total += total; else pendiente.set(clave, { dia, tipo, ruta, total });
  }

  function middleware(req, res, next) {
    if (EXCLUIDAS.test(String(req.originalUrl).split('?')[0])) return next();
    res.on('finish', () => { // al terminar la respuesta ya se sabe cómo acabó
      const dia = fechaBolivia(ahora());
      const ruta = clasificar(req.originalUrl, patrones);
      sumar(dia, 'peticion', ruta);
      if (ruta === RUTA_DESCARGA && res.statusCode === 200) sumar(dia, 'descarga', ruta);
    });
    next();
  }

  // Pasa los contadores acumulados a la base. Devuelve cuántos contadores se guardaron.
  async function volcar() {
    if (!pendiente.size) return 0;
    const lote = pendiente;
    pendiente = new Map();
    let guardados = 0;
    for (const item of lote.values()) {
      try { await repositorio.sumarUso(item); guardados += 1; } catch (err) {
        sumar(item.dia, item.tipo, item.ruta, item.total); // se devuelve para reintentar
        logger.error(`[medicion] no se pudo guardar el uso: ${err.message}`);
      }
    }
    return guardados;
  }

  return {
    middleware,
    volcar,
    iniciar() {
      if (reloj) return;
      reloj = programar(() => { volcar().catch(() => {}); }, cadaMs);
      if (reloj && reloj.unref) reloj.unref(); // no impide que el proceso termine
    },
    async detener() { if (reloj) cancelar(reloj); reloj = null; await volcar(); },
    pendientes: () => pendiente.size, // para pruebas
  };
}

module.exports = { crearMedidor, clasificar, compilarRutas };
