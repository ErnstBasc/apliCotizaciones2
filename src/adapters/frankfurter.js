// Adaptador de Frankfurter v2: monedas contra el dólar. Una sola petición trae todas.
// Respuesta real: [{ date, base:'USD', quote:'EUR', rate:0.89145 }, …]
// Nota: NO pedimos BOB; el boliviano sale del BCB (el de Frankfurter difiere del oficial).
const { crearObservacion } = require('../contracts/observacion');
const { pedirTexto } = require('./http');

const MONEDAS = ['EUR', 'CLP', 'ARS', 'PEN', 'BRL', 'PYG'];
const URL_BASE = 'https://api.frankfurter.dev/v2/rates';

function convertir(json) {
  const lista = JSON.parse(json);
  if (!Array.isArray(lista)) throw new Error('Frankfurter: formato inesperado (se esperaba un arreglo)');
  const observaciones = [];
  for (const fila of lista) {
    if (!MONEDAS.includes(fila.quote)) continue; // ignora lo que no pedimos
    if (!(fila.rate > 0)) throw new Error(`Frankfurter: tasa inválida para ${fila.quote}`);
    observaciones.push(crearObservacion({
      instrumento: fila.quote, entidad: null, valor: fila.rate, unidad: 'por USD', fecha: fila.date,
    }));
  }
  if (observaciones.length === 0) throw new Error('Frankfurter: no devolvió ninguna de las monedas pedidas');
  return observaciones;
}

function crearAdaptadorFrankfurter({ fetchFn = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  return {
    nombre: 'frankfurter',
    instrumentos: MONEDAS,
    async obtener() {
      const url = `${URL_BASE}?base=USD&quotes=${MONEDAS.join(',')}`;
      return convertir(await pedirTexto(fetchFn, url, { timeoutMs }));
    },
  };
}

module.exports = { crearAdaptadorFrankfurter, convertir, MONEDAS };
