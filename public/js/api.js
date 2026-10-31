// Único lugar que habla con el servidor. Mismo origen: no necesita CORS, y el navegador adjunta solo la cookie de sesión.
async function pedir(ruta, { metodo = 'GET', cuerpo, tiempoMs = 25_000 } = {}) {
  const cabeceras = { Accept: 'application/json' };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(tiempoMs),
    });
  } catch {
    throw new Error('No hay conexión con el servidor.');
  }
  let datos = null;
  try { datos = await respuesta.json(); } catch { /* sin cuerpo JSON */ }
  if (!respuesta.ok) throw new Error((datos && datos.mensaje) || `El servidor respondió ${respuesta.status}.`);
  return datos;
}

export const obtener = (ruta, opciones = {}) => pedir(ruta, opciones);
export const enviar = (ruta, cuerpo, metodo = 'POST') => pedir(ruta, { metodo, cuerpo: cuerpo ?? {} });
