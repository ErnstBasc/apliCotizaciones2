// Fábrica de la aplicación Express. NO abre puertos ni conexiones: recibe sus dependencias ya hechas.
// Así se puede probar con dependencias falsas, y server.js (la "raíz de composición") es el único
// lugar donde se arma todo con piezas reales.
const express = require('express');
const { crearRutaHealth } = require('./routes/health');
const { crearRutasFuentes } = require('./routes/fuentes');
const { noEncontrado, manejarErrores } = require('./middleware/errores');

function crearApp({ repositorio, cotizaciones, logger = console }) {
  const app = express();
  app.disable('x-powered-by'); // no anunciar la tecnología del servidor
  app.use(express.json({ limit: '10kb' })); // cuerpos pequeños: evita peticiones gigantes

  app.use('/health', crearRutaHealth(express, repositorio));

  app.use('/', crearRutasFuentes(express, cotizaciones));
  // Los pasos siguientes agregan aquí más rutas (indicadores, bancos, conversor, docs…).

  app.use(noEncontrado);
  app.use(manejarErrores(logger));
  return app;
}

module.exports = { crearApp };
