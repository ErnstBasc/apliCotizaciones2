const test = require('node:test');
const assert = require('node:assert');
const v = require('../src/routes/validacion');
const { manejadoresUsuarios, crearRutasUsuarios } = require('../src/routes/usuarios');
const { crearAutenticacion, mismoOrigen } = require('../src/middleware/autenticacion');
const { crearSesiones } = require('../src/utilidades/sesiones');
const { crearServicioUsuarios } = require('../src/services/usuariosService');
const { crearRepositorioFalso, clavesFalsas } = require('./ayudas/usuariosFalso');

const SECRETO = 's'.repeat(40);
const OK = { correo: 'Ana@Ejemplo.COM ', clave: 'una-clave-larga-1' };

// ---------- validación ----------
test('validación de registro: normaliza el correo y exige clave de 10 a 128 caracteres', () => {
  assert.deepStrictEqual(v.validarRegistro(OK), { correo: 'ana@ejemplo.com', clave: 'una-clave-larga-1' });
  for (const mal of ['sin-arroba', 'a@b', 'a b@c.com', '@c.com', 'a@@c.com', 'a@c..com', `${'x'.repeat(250)}@c.com`, '']) {
    assert.throws(() => v.validarRegistro({ correo: mal, clave: OK.clave }), /correo|Falta/, mal);
  }
  assert.throws(() => v.validarRegistro({ correo: OK.correo, clave: 'corta' }), /entre 10 y 128/);
  assert.throws(() => v.validarRegistro({ correo: OK.correo, clave: 'x'.repeat(129) }), /entre 10 y 128/);
});

test('validación: el cuerpo debe ser un objeto con textos (nada de números, arreglos u objetos anidados)', () => {
  for (const cuerpo of [undefined, null, [], 'texto', 5]) assert.throws(() => v.validarRegistro(cuerpo), /objeto JSON/);
  assert.throws(() => v.validarRegistro({ correo: { $ne: '' }, clave: OK.clave }), /Falta el campo "correo"/);
  assert.throws(() => v.validarIngreso({ correo: 'a@b.co', clave: 12345 }), /Falta el campo "clave"/);
  assert.deepStrictEqual(v.validarIngreso({ correo: 'a@b.co', clave: 'x', admin: true }), { correo: 'a@b.co', clave: 'x' }); // campos extra se ignoran
});

test('validación de token: exactamente 43 caracteres base64url', () => {
  const bueno = 'A'.repeat(43);
  assert.deepStrictEqual(v.validarToken({ token: bueno }), { token: bueno });
  for (const malo of ['corto', 'A'.repeat(44), `${'A'.repeat(42)}!`, "' OR 1=1 --"]) assert.throws(() => v.validarToken({ token: malo }));
  assert.deepStrictEqual(v.validarRestablecer({ token: bueno, clave: 'clave-nueva-123' }), { token: bueno, clave: 'clave-nueva-123' });
  assert.throws(() => v.validarCambioClave({ claveActual: 'x', claveNueva: 'corta' }), /entre 10 y 128/);
});

// ---------- CSRF ----------
test('mismoOrigen: GET libre; POST sin Origin pasa; mismo origen pasa; otro origen o basura → 403', () => {
  const ejecutar = (req) => { let e; mismoOrigen(req, {}, (x) => { e = x; }); return e; };
  assert.strictEqual(ejecutar({ method: 'GET', headers: { origin: 'http://malo.com', host: 'sitio.test' } }), undefined);
  assert.strictEqual(ejecutar({ method: 'POST', headers: { host: 'sitio.test' } }), undefined);
  assert.strictEqual(ejecutar({ method: 'POST', headers: { origin: 'http://sitio.test', host: 'sitio.test' } }), undefined);
  assert.strictEqual(ejecutar({ method: 'POST', headers: { origin: 'http://malo.com', host: 'sitio.test' } }).estado, 403);
  assert.strictEqual(ejecutar({ method: 'DELETE', headers: { origin: 'null', host: 'sitio.test' } }).estado, 403);
  assert.strictEqual(ejecutar({ method: 'POST', headers: { origin: 'http://sitio.test.malo.com', host: 'sitio.test' } }).estado, 403);
});

// ---------- flujo completo con las piezas reales (menos la base y el correo) ----------
function entorno() {
  const repositorio = crearRepositorioFalso();
  const correos = [];
  const usuarios = crearServicioUsuarios({ repositorio, claves: clavesFalsas, urlPublica: 'http://sitio.test', mailer: { enviar: async (c) => { correos.push(c); } }, logger: { error() {} } });
  const sesiones = crearSesiones({ secreto: SECRETO });
  const autenticacion = crearAutenticacion({ sesiones, usuarios });
  const h = manejadoresUsuarios(usuarios, sesiones);
  return { repositorio, correos, usuarios, sesiones, autenticacion, h };
}
function resFalsa() {
  const r = { cabeceras: {} };
  r.setHeader = (k, val) => { r.cabeceras[k] = val; };
  r.json = (c) => { r.cuerpo = c; return r; };
  return r;
}
const galleta = (res) => res.cabeceras['Set-Cookie'].split(';')[0];
async function llamar(fn, req) { const res = resFalsa(); let error; await fn(req, res, (e) => { error = e; }); return { res, error }; }

test('flujo: registrar → verificar → ingresar (cookie) → yo → cambiar clave → eliminar', async () => {
  const { correos, autenticacion, h } = entorno();
  await llamar(h.registro, { body: OK });
  const token = correos[0].texto.match(/verificar=(\S+)/)[1];
  assert.strictEqual((await llamar(h.verificar, { body: { token } })).error, undefined);

  const entrada = await llamar(h.ingresar, { body: OK });
  assert.strictEqual(entrada.res.cuerpo.usuario.correo, 'ana@ejemplo.com');
  assert.ok(!('versionSesion' in entrada.res.cuerpo.usuario));
  assert.match(entrada.res.cabeceras['Set-Cookie'], /HttpOnly/);
  assert.strictEqual(entrada.res.cabeceras['Cache-Control'], 'no-store');

  // /yo con la cookie
  const reqSesion = { headers: { cookie: galleta(entrada.res) } };
  const guardia = await llamar(autenticacion.exigirSesion, reqSesion);
  assert.strictEqual(guardia.error, undefined);
  assert.strictEqual(reqSesion.usuario.verificado, true);
  const yo = await llamar((rq, rs) => h.yo(rq, rs), reqSesion);
  assert.deepStrictEqual(Object.keys(yo.res.cuerpo.usuario).sort(), ['correo', 'creadoEn', 'id', 'rol', 'verificado']);

  // cambiar clave: la cookie vieja deja de servir, la nueva sí
  const cambio = await llamar(h.cambiarClave, { ...reqSesion, body: { claveActual: OK.clave, claveNueva: 'clave-nueva-123' } });
  assert.strictEqual(cambio.error, undefined);
  assert.strictEqual((await llamar(autenticacion.exigirSesion, { headers: { cookie: galleta(entrada.res) } })).error.estado, 401);
  const nueva = { headers: { cookie: galleta(cambio.res) } };
  assert.strictEqual((await llamar(autenticacion.exigirSesion, nueva)).error, undefined);

  // eliminar: pide clave y luego la cookie ya no sirve
  assert.strictEqual((await llamar(h.eliminar, { ...nueva, body: { clave: 'incorrecta-123' } })).error.estado, 403);
  const baja = await llamar(h.eliminar, { ...nueva, body: { clave: 'clave-nueva-123' } });
  assert.strictEqual(baja.error, undefined);
  assert.match(baja.res.cabeceras['Set-Cookie'], /Max-Age=0/);
  assert.strictEqual((await llamar(autenticacion.exigirSesion, nueva)).error.estado, 401);
});

test('guardia: sin cookie, cookie alterada o de otro secreto → 401 y limpia la cookie', async () => {
  const { autenticacion, sesiones } = entorno();
  for (const headers of [{}, { cookie: 'sesion=basura' }, { cookie: `sesion=${'a.b.c'}` }]) {
    const { res, error } = await llamar(autenticacion.exigirSesion, { headers });
    assert.strictEqual(error.estado, 401, JSON.stringify(headers));
    assert.match(res.cabeceras['Set-Cookie'], /Max-Age=0/);
  }
  const ajena = crearSesiones({ secreto: 'z'.repeat(40) });
  const r = resFalsa(); ajena.emitir(r, { id: 1, versionSesion: 0 });
  assert.strictEqual((await llamar(autenticacion.exigirSesion, { headers: { cookie: galleta(r) } })).error.estado, 401);
  assert.ok(sesiones);
});

test('exigirVerificado: 403 si el correo no está confirmado; pasa si lo está', () => {
  const { autenticacion } = entorno();
  const ejecutar = (usuario) => { let e; autenticacion.exigirVerificado({ usuario }, {}, (x) => { e = x; }); return e; };
  assert.strictEqual(ejecutar({ verificado: false }).estado, 403);
  assert.strictEqual(ejecutar(undefined).estado, 401);
  assert.strictEqual(ejecutar({ verificado: true }), undefined);
});

test('ingresar con datos inválidos o credenciales malas: el error va a next y no se emite cookie', async () => {
  const { h } = entorno();
  const a = await llamar(h.ingresar, { body: { correo: 'x', clave: 'y' } });
  assert.strictEqual(a.error.estado, 400); assert.strictEqual(a.res.cabeceras['Set-Cookie'], undefined);
  const b = await llamar(h.ingresar, { body: { correo: 'nadie@ejemplo.com', clave: 'incorrecta-123' } });
  assert.strictEqual(b.error.estado, 401); assert.strictEqual(b.res.cabeceras['Set-Cookie'], undefined);
});

test('rutas: cada ruta se registra con su método y las privadas llevan guardia', () => {
  const rutas = [];
  const router = { use() {}, post: (p, ...fns) => rutas.push(['POST', p, fns.length]), get: (p, ...fns) => rutas.push(['GET', p, fns.length]), delete: (p, ...fns) => rutas.push(['DELETE', p, fns.length]) };
  const { usuarios, sesiones, autenticacion } = entorno();
  crearRutasUsuarios({ Router: () => router }, { usuarios, sesiones, autenticacion, mismoOrigen });
  const mapa = Object.fromEntries(rutas.map(([m, p, n]) => [`${m} ${p}`, n]));
  assert.deepStrictEqual(Object.keys(mapa).sort(), [
    'DELETE /yo', 'GET /yo', 'POST /cambiar-clave', 'POST /ingresar', 'POST /recuperar', 'POST /registro',
    'POST /reenviar-verificacion', 'POST /restablecer', 'POST /salir', 'POST /verificar',
  ].sort());
  for (const privada of ['DELETE /yo', 'GET /yo', 'POST /cambiar-clave']) assert.strictEqual(mapa[privada], 2, `${privada} debe llevar guardia + manejador`);
  for (const publica of ['POST /ingresar', 'POST /registro']) assert.strictEqual(mapa[publica], 1);
});
