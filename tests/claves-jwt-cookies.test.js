const test = require('node:test');
const assert = require('node:assert');
const claves = require('../src/utilidades/claves');
const jwt = require('../src/utilidades/jwt');
const cookies = require('../src/utilidades/cookies');
const { crearSesiones } = require('../src/utilidades/sesiones');

const RAPIDO = { N: 1024, r: 8, p: 1 }; // parámetros baratos solo para los tests
const SECRETO = 'x'.repeat(40);

test('claves: el hash no contiene la clave, lleva sal (dos hashes distintos) y verifica bien', async () => {
  const h1 = await claves.hashear('mi-clave-secreta', RAPIDO);
  const h2 = await claves.hashear('mi-clave-secreta', RAPIDO);
  assert.ok(h1.startsWith('scrypt$1024$8$1$'));
  assert.ok(!h1.includes('mi-clave-secreta'));
  assert.notStrictEqual(h1, h2);
  assert.strictEqual(await claves.verificar('mi-clave-secreta', h1), true);
  assert.strictEqual(await claves.verificar('otra-clave', h1), false);
});

test('claves: un hash guardado mal formado da false, no lanza', async () => {
  for (const malo of ['', 'basura', 'scrypt$a$b$c$d$e', 'md5$1$2$3$4$5', null, undefined]) {
    assert.strictEqual(await claves.verificar('x', malo), false);
  }
});

test('claves: la normalización Unicode hace equivalentes "ñ" compuesta y "n" + tilde', async () => {
  const h = await claves.hashear('contrase\u00f1a-larga', RAPIDO);
  assert.strictEqual(await claves.verificar('contrasen\u0303a-larga', h), true);
});

test('jwt: firma y verifica; carga alterada, otro secreto, vencido, alg none y basura se rechazan', () => {
  const t = jwt.firmar({ sub: 7, sv: 0 }, SECRETO, { ahoraS: 1000, duracionS: 60 });
  assert.strictEqual(jwt.verificar(t, SECRETO, { ahoraS: 1010 }).sub, 7);
  assert.strictEqual(jwt.verificar(t, 'y'.repeat(40), { ahoraS: 1010 }), null);
  assert.strictEqual(jwt.verificar(t, SECRETO, { ahoraS: 1060 }), null); // exp = 1060 ya no vale
  const [c, , f] = t.split('.');
  const otraCarga = Buffer.from(JSON.stringify({ sub: 1, exp: 99999999999 })).toString('base64url');
  assert.strictEqual(jwt.verificar(`${c}.${otraCarga}.${f}`, SECRETO, { ahoraS: 1010 }), null);
  const cabNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  assert.strictEqual(jwt.verificar(`${cabNone}.${otraCarga}.`, SECRETO, { ahoraS: 1010 }), null);
  for (const basura of ['', 'a.b', 'a.b.c.d', null, 42, undefined]) assert.strictEqual(jwt.verificar(basura, SECRETO), null);
});

test('cookies: lee varias, ignora basura y serializa con los atributos de seguridad', () => {
  assert.deepStrictEqual(cookies.leer('a=1; sesion=abc%20d; =x; b'), { a: '1', sesion: 'abc d' });
  assert.deepStrictEqual(cookies.leer(undefined), {});
  const c = cookies.serializar('sesion', 'tok', { maxAgeS: 60, secure: true });
  for (const parte of ['sesion=tok', 'HttpOnly', 'SameSite=Strict', 'Secure', 'Max-Age=60', 'Path=/']) assert.ok(c.includes(parte), parte);
  assert.ok(!cookies.serializar('s', 'v').includes('Secure'));
});

test('sesiones: emite cookie, la lee de vuelta, la limpia; exige secreto largo; __Host- en modo seguro', () => {
  assert.throws(() => crearSesiones({ secreto: 'corto' }));
  const s = crearSesiones({ secreto: SECRETO, duracionDias: 1, reloj: () => 5_000_000 });
  const res = { setHeader(k, v) { this[k] = v; } };
  s.emitir(res, { id: 3, versionSesion: 2 });
  assert.ok(res['Set-Cookie'].startsWith('sesion='));
  const galleta = res['Set-Cookie'].split(';')[0];
  const carga = s.leer({ headers: { cookie: galleta } });
  assert.strictEqual(carga.sub, 3); assert.strictEqual(carga.sv, 2);
  assert.strictEqual(s.leer({ headers: {} }), null);
  s.limpiar(res); assert.match(res['Set-Cookie'], /Max-Age=0/);
  assert.strictEqual(crearSesiones({ secreto: SECRETO, segura: true }).nombre, '__Host-sesion');
  // vencida: el reloj avanza más de 1 día
  const tarde = crearSesiones({ secreto: SECRETO, reloj: () => 5_000_000 + 2 * 86_400_000 });
  assert.strictEqual(tarde.leer({ headers: { cookie: galleta } }), null);
});
