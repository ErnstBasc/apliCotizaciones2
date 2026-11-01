// Raíz de composición: el ÚNICO archivo que crea las piezas reales y las conecta.
require('dotenv').config();

const { cargarConfig } = require('./config');
const { crearPool } = require('./repositories/pool');
const { crearRepositorioCotizaciones } = require('./repositories/cotizacionesRepositorio');
const { crearApp } = require('./app');
const { crearServicioCache } = require('./services/cacheService');
const { crearServicioCotizaciones } = require('./services/cotizacionesService');
const { crearServicioCalculos } = require('./services/calculosService');
const { crearServicioHistorico } = require('./services/historicoService');
const { crearAdaptadores, crearMailer } = require('./composicion');
const crypto = require('node:crypto');
const { crearRepositorioUsuarios } = require('./repositories/usuariosRepositorio');
const { crearServicioUsuarios } = require('./services/usuariosService');
const { crearRepositorioAlertas } = require('./repositories/alertasRepositorio');
const { crearServicioAlertas } = require('./services/alertasService');
const { crearSesiones } = require('./utilidades/sesiones');
const claves = require('./utilidades/claves');
const { crearAutenticacion, mismoOrigen } = require('./middleware/autenticacion');

const config = cargarConfig();
const pool = crearPool(config.db);
const repositorio = crearRepositorioCotizaciones(pool);

// Adaptadores (una fuente externa cada uno) → caché → servicio de cotizaciones
const adaptadores = crearAdaptadores();
const cache = crearServicioCache({ repositorio });
const cotizaciones = crearServicioCotizaciones({ cache, adaptadores, cacheMin: config.cacheMin });

const calculos = crearServicioCalculos({ cotizaciones });
const historico = crearServicioHistorico({ repositorio });

// Cuentas de usuario y alertas. El mailer es intercambiable: imprime en consola o envía por SMTP.
let secretoSesion = config.auth.secreto;
if (!secretoSesion) {
  secretoSesion = crypto.randomBytes(32).toString('hex');
  console.warn('AVISO: falta JWT_SECRET en .env; se usa uno temporal y las sesiones se cerrarán al reiniciar.');
}
const mailer = crearMailer(config); // consola o SMTP real, según MAIL_MODO
const usuarios = crearServicioUsuarios({ repositorio: crearRepositorioUsuarios(pool), mailer, claves, urlPublica: config.auth.urlPublica });
const sesiones = crearSesiones({ secreto: secretoSesion, duracionDias: config.auth.duracionDias, segura: config.auth.cookieSegura });
const alertas = crearServicioAlertas({ repositorio: crearRepositorioAlertas(pool), maximoPorUsuario: config.alertas.maxPorUsuario, enfriamientoHoras: config.alertas.enfriamientoHoras });
const cuentas = { usuarios, sesiones, autenticacion: crearAutenticacion({ sesiones, usuarios }), mismoOrigen, alertas };

const app = crearApp({ repositorio, cotizaciones, calculos, historico, cuentas, corsOrigenes: config.corsOrigenes });

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
