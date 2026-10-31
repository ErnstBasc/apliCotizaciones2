// Raíz de composición: el ÚNICO archivo que crea las piezas reales y las conecta.
require('dotenv').config();

const { cargarConfig } = require('./config');
const { crearPool } = require('./repositories/pool');
const { crearRepositorioCotizaciones } = require('./repositories/cotizacionesRepositorio');
const { crearApp } = require('./app');
const { crearServicioCache } = require('./services/cacheService');
const { crearServicioCotizaciones } = require('./services/cotizacionesService');
const { crearServicioCalculos } = require('./services/calculosService');
const { crearAdaptadores } = require('./composicion');

const config = cargarConfig();
const pool = crearPool(config.db);
const repositorio = crearRepositorioCotizaciones(pool);

// Adaptadores (una fuente externa cada uno) → caché → servicio de cotizaciones
const adaptadores = crearAdaptadores();
const cache = crearServicioCache({ repositorio });
const cotizaciones = crearServicioCotizaciones({ cache, adaptadores, cacheMin: config.cacheMin });

const calculos = crearServicioCalculos({ cotizaciones });

const app = crearApp({ repositorio, cotizaciones, calculos, corsOrigenes: config.corsOrigenes });

const servidor = app.listen(config.puerto, () => {
  console.log(`apliCotizaciones2 escuchando en http://localhost:${config.puerto}  (entorno: ${config.entorno})`);
  console.log('Vigencia del caché (min):', JSON.stringify(config.cacheMin));
  console.log('CORS:', config.corsOrigenes.length ? config.corsOrigenes.join(', ') : 'sin orígenes externos (solo mismo origen)');
  console.log(`Documentación: http://localhost:${config.puerto}/docs`);
});

servidor.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`El puerto ${config.puerto} ya está en uso. Cierra el otro servidor o cambia PORT en .env.`);
  } else {
    console.error('No se pudo iniciar el servidor:', err.message);
  }
  process.exit(1);
});

// Cierre ordenado con Ctrl+C: deja de aceptar peticiones y cierra las conexiones a la base.
function cerrar() {
  console.log('\nCerrando…');
  servidor.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
