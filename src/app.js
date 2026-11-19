// Fábrica de la aplicación Express. NO abre puertos ni conexiones: recibe sus dependencias ya hechas.
// Así se puede probar con dependencias falsas, y server.js (la "raíz de composición") es el único
// lugar donde se arma todo con piezas reales.
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const especificacion = require('./docs');
const { crearCors } = require('./middleware/cors');
const { crearCabecerasSeguridad } = require('./middleware/cabeceras');
const { crearRutaHealth } = require('./routes/health');
const { crearRutasFuentes } = require('./routes/fuentes');
const { crearRutasEntidades } = require('./routes/entidades');
const { crearRutasCalculos } = require('./routes/calculos');
const { crearRutasHistorico } = require('./routes/historico');
const { crearRutasUsuarios } = require('./routes/usuarios');
const { crearRutasAlertas } = require('./routes/alertas');
const { crearRutasAdmin } = require('./routes/admin');
const { noEncontrado, manejarErrores } = require('./middleware/errores');

// `cuentas` agrupa lo de usuarios: { usuarios, sesiones, autenticacion, mismoOrigen, alertas } (opcional: sin él no hay rutas /usuarios)
// `cuentas.estadisticas` (opcional) activa el panel del administrador (/admin). `medidor` (opcional) cuenta el uso de la API.
// `limites` = limitadores de peticiones (o null para desactivarlos). `seguridad` = { proxiesConfiables, https }.
function crearApp({ repositorio, cotizaciones, calculos, historico, cuentas, limites = null, medidor = null, seguridad = {}, corsOrigenes = [], logger = console }) {
  const app = express();
  app.disable('x-powered-by'); // no anunciar la tecnología del servidor
  if (seguridad.proxiesConfiables > 0) app.set('trust proxy', seguridad.proxiesConfiables); // la IP real viene del proxy que hay delante
  app.use(crearCabecerasSeguridad({ https: Boolean(seguridad.https) })); // CSP, nosniff, referrer, anti-marcos…
  app.use(crearCors(corsOrigenes)); // lista blanca de orígenes (vacía = solo mismo origen)
  app.use(express.json({ limit: '10kb' })); // cuerpos pequeños: evita peticiones gigantes

  // Documentación interactiva (Swagger UI)
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(especificacion, { customSiteTitle: 'apliCotizaciones2 · API' }));

  // Frontend estático (HTML, CSS y JS sin frameworks) en el mismo origen que la API: no necesita CORS
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // El límite general solo cuenta las rutas de la API: los archivos de la página (arriba) no gastan cupo
  if (limites) app.use(limites.general);
  if (medidor) app.use(medidor.middleware); // cuenta cada petición a la API (después del límite: solo las que se atienden)

  app.use('/health', crearRutaHealth(express, repositorio));

  app.use('/', crearRutasFuentes(express, cotizaciones));
  app.use('/', crearRutasEntidades(express, cotizaciones));
  app.use('/', crearRutasCalculos(express, calculos));
  // La descarga CSV exige sesión y correo confirmado; sin cuentas configuradas, esa ruta no existe
  const guardiasCsv = cuentas && [limites && limites.descargas, cuentas.autenticacion.exigirSesion, cuentas.autenticacion.exigirVerificado].filter(Boolean);
  app.use('/', crearRutasHistorico(express, historico, guardiasCsv));
  if (cuentas) app.use('/usuarios', crearRutasUsuarios(express, { ...cuentas, limites }));
  if (cuentas && cuentas.alertas) app.use('/alertas', crearRutasAlertas(express, cuentas));
  if (cuentas && cuentas.estadisticas) app.use('/admin', crearRutasAdmin(express, cuentas));
  // Los pasos siguientes agregan aquí más rutas (indicadores, bancos, conversor, docs…).

  app.use(noEncontrado);
  app.use(manejarErrores(logger));
  return app;
}

module.exports = { crearApp };
