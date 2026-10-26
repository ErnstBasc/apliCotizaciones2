// Cliente de la API pública de dolarbluebolivia.click (tercero, en beta). Lo comparten los adaptadores
// del paralelo (respaldo), de Wallbit y de los bancos. Solo sabe pedir JSON; no interpreta los datos.
const { pedirTexto } = require('../http');

const BASE = 'https://api.dolarbluebolivia.click';

function crearClienteDolarblue({ fetchFn = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  return {
    async obtenerJson(ruta) {
      return JSON.parse(await pedirTexto(fetchFn, BASE + ruta, { timeoutMs }));
    },
  };
}

module.exports = { crearClienteDolarblue, BASE };
