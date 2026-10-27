// Único lugar que habla con el servidor. Mismo origen: no necesita CORS.
export async function obtener(ruta, { tiempoMs = 25_000 } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(ruta, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(tiempoMs) });
  } catch {
    throw new Error('No hay conexión con el servidor.');
  }
  let cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch { /* sin cuerpo JSON */ }
  if (!respuesta.ok) throw new Error((cuerpo && cuerpo.mensaje) || `El servidor respondió ${respuesta.status}.`);
  return cuerpo;
}
