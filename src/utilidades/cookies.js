// Lectura y escritura de cookies sin dependencias.
function leer(cabecera) {
  const cookies = {};
  if (typeof cabecera !== 'string') return cookies;
  for (const par of cabecera.split(';')) {
    const i = par.indexOf('=');
    const nombre = par.slice(0, Math.max(i, 0)).trim();
    if (!nombre) continue;
    let valor = par.slice(i + 1).trim();
    try { valor = decodeURIComponent(valor); } catch { continue; }
    if (!(nombre in cookies)) cookies[nombre] = valor;
  }
  return cookies;
}

// Atributos de seguridad: HttpOnly (JavaScript de la página no puede leerla), SameSite (no viaja en peticiones de otros sitios),
// Secure (solo por HTTPS).
function serializar(nombre, valor, { maxAgeS, httpOnly = true, sameSite = 'Strict', secure = false, path = '/' } = {}) {
  const partes = [`${nombre}=${encodeURIComponent(valor)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (maxAgeS !== undefined) partes.push(`Max-Age=${maxAgeS}`);
  if (httpOnly) partes.push('HttpOnly');
  if (secure) partes.push('Secure');
  return partes.join('; ');
}

module.exports = { leer, serializar };
