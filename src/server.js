// Raíz de composición: el ÚNICO archivo que crea las piezas reales y las conecta.
require('dotenv').config();

const { cargarConfig } = require('./config');
const { crearPool } = require('./repositories/pool');
const { crearRepositorioCotizaciones } = require('./repositories/cotizacionesRepositorio');
const { crearApp } = require('./app');

const config = cargarConfig();
const pool = crearPool(config.db);
const repositorio = crearRepositorioCotizaciones(pool);
const app = crearApp({ repositorio });

const servidor = app.listen(config.puerto, () => {
  console.log(`apliCotizaciones2 escuchando en http://localhost:${config.puerto}  (entorno: ${config.entorno})`);
  console.log('Vigencia del caché (min):', JSON.stringify(config.cacheMin));
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
