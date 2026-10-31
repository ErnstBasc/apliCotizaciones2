// Punto de entrada del recolector (npm run recolector). Es un proceso APARTE del servidor web:
// puede estar encendido sin el servidor, o al revés, y si uno se cae el otro sigue. Comparten la base de datos.
require('dotenv').config();

const { cargarConfig } = require('./config');
const { crearPool } = require('./repositories/pool');
const { crearRepositorioCotizaciones } = require('./repositories/cotizacionesRepositorio');
const { crearServicioCache } = require('./services/cacheService');
const { crearServicioCotizaciones } = require('./services/cotizacionesService');
const { crearRecolector, crearTareas } = require('./services/recolector');
const { crearAdaptadores } = require('./composicion');

const config = cargarConfig();
const pool = crearPool(config.db);
const repositorio = crearRepositorioCotizaciones(pool);

// Vigencia 0 en todo: el recolector SIEMPRE consulta la fuente (su intervalo ya decide cada cuánto)
const sinCache = Object.fromEntries(Object.keys(config.cacheMin).map((clave) => [clave, 0]));
const cotizaciones = crearServicioCotizaciones({
  cache: crearServicioCache({ repositorio }),
  adaptadores: crearAdaptadores(),
  cacheMin: sinCache,
});

const recolector = crearRecolector({ tareas: crearTareas({ cotizaciones, cadaMin: config.recolectorMin }) });
recolector.iniciar();

// Cierre ordenado con Ctrl+C: no inicia lecturas nuevas, espera la que esté en curso y cierra la base.
let cerrando = false;
async function cerrar() {
  if (cerrando) return;
  cerrando = true;
  console.log('\n[recolector] cerrando…');
  await recolector.detener();
  await pool.end();
  process.exit(0);
}
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
