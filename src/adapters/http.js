// Utilidad compartida por los adaptadores: pide un texto por HTTP con tiempo límite y error claro.
// "fetchFn" se recibe desde afuera: en producción es el fetch de Node; en las pruebas, uno falso.
async function pedirTexto(fetchFn, url, { timeoutMs = 10_000, headers = {}, ...resto } = {}) {
  const respuesta = await fetchFn(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (apliCotizaciones2, proyecto universitario)', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
    ...resto,
  });
  if (!respuesta.ok) throw new Error(`${url} respondió HTTP ${respuesta.status}`);
  return respuesta.text();
}

module.exports = { pedirTexto };
