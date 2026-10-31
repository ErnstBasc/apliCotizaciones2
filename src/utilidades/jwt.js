// Mini JWT (HS256) hecho con node:crypto. Un JWT son tres partes en base64url: cabecera.carga.firma.
// La firma es un HMAC con un secreto que solo conoce el servidor: si alguien cambia la carga, la firma deja de cuadrar.
// OJO: la carga está codificada, NO cifrada; cualquiera puede leerla. Nunca poner secretos dentro.
const crypto = require('node:crypto');

const CABECERA = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

const firmarTexto = (texto, secreto) => crypto.createHmac('sha256', secreto).update(texto).digest('base64url');

function firmar(carga, secreto, { ahoraS = Math.floor(Date.now() / 1000), duracionS }) {
  const cuerpo = Buffer.from(JSON.stringify({ ...carga, iat: ahoraS, exp: ahoraS + duracionS })).toString('base64url');
  return `${CABECERA}.${cuerpo}.${firmarTexto(`${CABECERA}.${cuerpo}`, secreto)}`;
}

// Devuelve la carga si el token es auténtico y vigente; si no, null (sin explicar por qué).
function verificar(token, secreto, { ahoraS = Math.floor(Date.now() / 1000) } = {}) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [cabecera, cuerpo, firma] = partes;
  if (cabecera !== CABECERA) return null; // solo HS256: rechaza "alg":"none" y cualquier otro algoritmo
  const esperada = Buffer.from(firmarTexto(`${cabecera}.${cuerpo}`, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  try {
    const carga = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    if (!carga || typeof carga.exp !== 'number' || carga.exp <= ahoraS) return null;
    return carga;
  } catch {
    return null;
  }
}

module.exports = { firmar, verificar };
