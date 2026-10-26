// Raíz de composición: el ÚNICO archivo que crea las piezas reales y las conecta.
require('dotenv').config();

const { cargarConfig } = require('./config');
const { crearPool } = require('./repositories/pool');
const { crearRepositorioCotizaciones } = require('./repositories/cotizacionesRepositorio');
const { crearApp } = require('./app');
const { verificarAdaptador } = require('./contracts/adaptador');
const { crearServicioCache } = require('./services/cacheService');
const { crearServicioCotizaciones } = require('./services/cotizacionesService');
const { crearAdaptadorFrankfurter } = require('./adapters/frankfurter');
const { crearDescargadorPortada } = require('./adapters/bcb/portada');
const { crearAdaptadorBcbOficial } = require('./adapters/bcb/oficial');
const { crearAdaptadorBcbIndicadores } = require('./adapters/bcb/indicadores');
const { crearAdaptadorBinance } = require('./adapters/binance');
const { crearClienteDolarblue } = require('./adapters/dolarbluebolivia/cliente');
const { crearAdaptadorParaleloRespaldo } = require('./adapters/dolarbluebolivia/paralelo');
const { crearAdaptadorWallbit } = require('./adapters/dolarbluebolivia/wallbit');
const { crearAdaptadorBancos } = require('./adapters/dolarbluebolivia/bancos');
const { conRespaldo } = require('./adapters/conRespaldo');

const config = cargarConfig();
const pool = crearPool(config.db);
const repositorio = crearRepositorioCotizaciones(pool);

// Adaptadores (una fuente externa cada uno) → caché → servicio de cotizaciones
const obtenerPortadaBcb = crearDescargadorPortada();
const clienteDolarblue = crearClienteDolarblue();
const adaptadores = {
  monedas: verificarAdaptador(crearAdaptadorFrankfurter()),
  oficial: verificarAdaptador(crearAdaptadorBcbOficial({ obtenerTexto: obtenerPortadaBcb })),
  indicadores: verificarAdaptador(crearAdaptadorBcbIndicadores({ obtenerTexto: obtenerPortadaBcb })),
  billeteras: verificarAdaptador(crearAdaptadorWallbit({ cliente: clienteDolarblue })),
  bancos: verificarAdaptador(crearAdaptadorBancos({ cliente: clienteDolarblue })),
  // Paralelo: Binance P2P; si falla, lectura agregada de dolarbluebolivia
  paralelo: verificarAdaptador(conRespaldo(
    crearAdaptadorBinance(),
    crearAdaptadorParaleloRespaldo({ cliente: clienteDolarblue })
  )),
};
const cache = crearServicioCache({ repositorio });
const cotizaciones = crearServicioCotizaciones({ cache, adaptadores, cacheMin: config.cacheMin });

const app = crearApp({ repositorio, cotizaciones });

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
