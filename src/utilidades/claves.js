// Contraseñas: NUNCA se guardan; se guarda un "hash" con sal. Se usa scrypt (viene con Node, sin dependencias):
// es lento y gasta memoria A PROPÓSITO, para que adivinar claves por fuerza bruta sea carísimo.
// Formato guardado: scrypt$N$r$p$sal$hash (los parámetros viajan con el hash, así se pueden subir más adelante).
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const PARAMETROS = { N: 16384, r: 8, p: 1 };
const LARGO_HASH = 32;

async function hashear(clave, parametros = PARAMETROS) {
  const sal = crypto.randomBytes(16);
  const { N, r, p } = parametros;
  const hash = await scrypt(clave.normalize('NFKC'), sal, LARGO_HASH, { N, r, p });
  return ['scrypt', N, r, p, sal.toString('base64'), hash.toString('base64')].join('$');
}

// Devuelve true/false; un hash mal formado simplemente da false (nunca lanza).
async function verificar(clave, guardado) {
  try {
    const [algoritmo, N, r, p, sal, hash] = String(guardado).split('$');
    if (algoritmo !== 'scrypt') return false;
    const esperado = Buffer.from(hash, 'base64');
    const calculado = await scrypt(clave.normalize('NFKC'), Buffer.from(sal, 'base64'), esperado.length, { N: Number(N), r: Number(r), p: Number(p) });
    return esperado.length > 0 && crypto.timingSafeEqual(calculado, esperado); // comparación en tiempo constante
  } catch {
    return false;
  }
}

module.exports = { hashear, verificar, PARAMETROS };
