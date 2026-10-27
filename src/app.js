// Fábrica de la aplicación Express. NO abre puertos ni conexiones: recibe sus dependencias ya hechas.
// Así se puede probar con dependencias falsas, y server.js (la "raíz de composición") es el único
// lugar donde se arma todo con piezas reales.
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const especificacion = require('./docs');
const { crearCors } = require('./middleware/cors');
const { crearRutaHealth } = require('./routes/health');
const { crearRutasFuentes } = require('./routes/fuentes');
const { crearRutasEntidades } = require('./routes/entidades');
const { crearRutasCalculos } = require('./routes/calculos');
const { noEncontrado, manejarErrores } = require('./middleware/errores');

function crearApp({ repositorio, cotizaciones, calculos, corsOrigenes = [], logger = console }) {
  const app = express();
  app.disable('x-powered-by'); // no anunciar la tecnología del servidor
  app.use(crearCors(corsOrigenes)); // lista blanca de orígenes (vacía = solo mismo origen)
  app.use(express.json({ limit: '10kb' })); // cuerpos pequeños: evita peticiones gigantes

  // Documentación interactiva (Swagger UI)
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(especificacion, { customSiteTitle: 'apliCotizaciones2 · API' }));

  // Frontend estático (HTML, CSS y JS sin frameworks) en el mismo origen que la API: no necesita CORS
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/health', crearRutaHealth(express, repositorio));

  app.use('/', crearRutasFuentes(express, cotizaciones));
  app.use('/', crearRutasEntidades(express, cotizaciones));
  app.use('/', crearRutasCalculos(express, calculos));
  // Los pasos siguientes agregan aquí más rutas (indicadores, bancos, conversor, docs…).

  app.use(noEncontrado);
  app.use(manejarErrores(logger));
  return app;
}

module.exports = { crearApp };
