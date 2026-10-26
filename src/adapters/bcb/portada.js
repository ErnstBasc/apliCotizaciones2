// Descarga la portada del BCB y la convierte en texto plano. Es lo único que sabe "cómo se baja la página";
// los extractores (oficial.js, y luego oro, UFV, inflación) solo trabajan con ese texto.
const { pedirTexto } = require('../http');

const URL_BCB = 'https://www.bcb.gob.bo/';

function htmlATexto(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

function crearDescargadorPortada({ fetchFn = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  return async () => htmlATexto(await pedirTexto(fetchFn, URL_BCB, { timeoutMs }));
}

module.exports = { crearDescargadorPortada, htmlATexto, URL_BCB };
