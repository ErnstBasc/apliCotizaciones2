const test = require('node:test');
const assert = require('node:assert');
const { crearServicioUsuarios, sha256 } = require('../src/services/usuariosService');
const { crearRepositorioFalso, clavesFalsas } = require('./ayudas/usuariosFalso');

function montar(extra = {}) {
  const repositorio = crearRepositorioFalso();
  const correos = [];
  let reloj = Date.parse('2026-10-31T12:00:00Z');
  let n = 0;
  const servicio = crearServicioUsuarios({
    repositorio, claves: clavesFalsas, urlPublica: 'http://sitio.test',
    mailer: { enviar: async (c) => { correos.push(c); } },
    ahora: () => new Date(reloj), generarToken: () => `token-${++n}`.padEnd(43, 'x'),
    logger: { error() {} }, ...extra,
  });
  return { servicio, repositorio, correos, avanzarMin: (m) => { reloj += m * 60_000; } };
}
const ALTA = { correo: 'ana@ejemplo.com', clave: 'una-clave-larga-1' };
const tokenDe = (correo) => correo.texto.match(/\?(?:verificar|restablecer)=(\S+)/)[1];

test('registrar: crea la cuenta sin verificar y envía el enlace; la clave se guarda hasheada', async () => {
  const { servicio, repositorio, correos } = montar();
  const r = await servicio.registrar(ALTA);
  assert.match(r.mensaje, /Si el correo es válido/);
  const u = await repositorio.buscarPorCorreo(ALTA.correo);
  assert.strictEqual(u.verificadoEn, null);
  assert.notStrictEqual(u.claveHash, ALTA.clave);
  assert.strictEqual(correos.length, 1);
  assert.match(correos[0].texto, /http:\/\/sitio\.test\/\?verificar=token-1/);
});

test('registrar: un correo ya registrado da la MISMA respuesta (no revela la cuenta) y avisa al dueño', async () => {
  const { servicio, correos } = montar();
  const primera = await servicio.registrar(ALTA);
  const segunda = await servicio.registrar({ ...ALTA, clave: 'otra-clave-larga-2' });
  assert.deepStrictEqual(segunda, primera);
  assert.strictEqual(correos.length, 2);
  assert.match(correos[1].asunto, /Ya tienes una cuenta/);
  assert.ok(!correos[1].texto.includes('?verificar='));
});

test('registrar: si falla el envío del correo igual responde bien (y registra el error)', async () => {
  const errores = [];
  const { servicio } = montar({ mailer: { enviar: async () => { throw new Error('SMTP caído'); } }, logger: { error: (...a) => errores.push(a.join(' ')) } });
  const r = await servicio.registrar(ALTA);
  assert.ok(r.mensaje);
  assert.ok(errores.some((e) => e.includes('SMTP caído')));
});

test('verificar: el token sirve una sola vez, marca el correo y se guarda solo su hash', async () => {
  const { servicio, repositorio, correos } = montar();
  await servicio.registrar(ALTA);
  const token = tokenDe(correos[0]);
  assert.ok(!JSON.stringify(repositorio.tokens).includes(token), 'el token en claro no debe guardarse');
  assert.strictEqual(repositorio.tokens[0].tokenHash, sha256(token));
  await servicio.verificar({ token });
  assert.ok((await repositorio.buscarPorCorreo(ALTA.correo)).verificadoEn);
  await assert.rejects(servicio.verificar({ token }), (e) => e.estado === 400);
});

test('verificar: un token vencido o inventado falla con el mismo mensaje', async () => {
  const { servicio, correos, avanzarMin } = montar();
  await servicio.registrar(ALTA);
  const token = tokenDe(correos[0]);
  avanzarMin(24 * 60 + 1);
  await assert.rejects(servicio.verificar({ token }), /no es válido o ya venció/);
  await assert.rejects(servicio.verificar({ token: 'inventado'.padEnd(43, 'z') }), /no es válido o ya venció/);
});

test('reenviar verificación: solo si existe y falta confirmar; el enlace nuevo reemplaza al anterior; respuesta igual siempre', async () => {
  const { servicio, correos } = montar();
  await servicio.registrar(ALTA);
  const viejo = tokenDe(correos[0]);
  const r1 = await servicio.reenviarVerificacion({ correo: ALTA.correo });
  const r2 = await servicio.reenviarVerificacion({ correo: 'nadie@ejemplo.com' });
  assert.deepStrictEqual(r1, r2);
  assert.strictEqual(correos.length, 2); // solo el de la cuenta real
  await assert.rejects(servicio.verificar({ token: viejo }));
  await servicio.verificar({ token: tokenDe(correos[1]) });
  await servicio.reenviarVerificacion({ correo: ALTA.correo }); // ya verificada: no envía más
  assert.strictEqual(correos.length, 2);
});

test('ingresar: devuelve el usuario sin datos internos; clave mala y correo inexistente dan el MISMO error', async () => {
  const { servicio } = montar();
  await servicio.registrar(ALTA);
  const u = await servicio.ingresar(ALTA);
  assert.strictEqual(u.correo, ALTA.correo);
  assert.strictEqual(u.verificado, false);
  assert.ok(!('claveHash' in u) && !('intentosFallidos' in u));
  const malaClave = await servicio.ingresar({ ...ALTA, clave: 'incorrecta-123' }).catch((e) => e);
  const sinCuenta = await servicio.ingresar({ correo: 'nadie@ejemplo.com', clave: 'incorrecta-123' }).catch((e) => e);
  assert.strictEqual(malaClave.estado, 401);
  assert.strictEqual(sinCuenta.estado, 401);
  assert.strictEqual(malaClave.message, sinCuenta.message);
});

test('ingresar: tras 5 fallos la cuenta se bloquea 15 min (aun con la clave correcta) y luego se libera', async () => {
  const { servicio, avanzarMin } = montar();
  await servicio.registrar(ALTA);
  for (let i = 0; i < 5; i++) await assert.rejects(servicio.ingresar({ ...ALTA, clave: 'mala-mala-mala' }), (e) => e.estado === 401);
  await assert.rejects(servicio.ingresar(ALTA), (e) => e.estado === 429);
  avanzarMin(16);
  assert.strictEqual((await servicio.ingresar(ALTA)).correo, ALTA.correo);
});

test('ingresar: un acierto reinicia el contador de fallos', async () => {
  const { servicio } = montar();
  await servicio.registrar(ALTA);
  for (let i = 0; i < 4; i++) await servicio.ingresar({ ...ALTA, clave: 'mala-mala-mala' }).catch(() => {});
  await servicio.ingresar(ALTA);
  for (let i = 0; i < 4; i++) await servicio.ingresar({ ...ALTA, clave: 'mala-mala-mala' }).catch(() => {});
  assert.strictEqual((await servicio.ingresar(ALTA)).correo, ALTA.correo); // 4+4 fallos separados por un acierto: no bloquea
});

test('recuperar y restablecer: respuesta igual exista o no; el token sirve una vez; cierra otras sesiones; verifica el correo', async () => {
  const { servicio, repositorio, correos } = montar();
  await servicio.registrar(ALTA);
  const r1 = await servicio.solicitarRecuperacion({ correo: ALTA.correo });
  const r2 = await servicio.solicitarRecuperacion({ correo: 'nadie@ejemplo.com' });
  assert.deepStrictEqual(r1, r2);
  assert.strictEqual(correos.length, 2);
  const antes = (await repositorio.buscarPorCorreo(ALTA.correo)).versionSesion;
  const token = tokenDe(correos[1]);
  await servicio.restablecer({ token, clave: 'clave-nueva-123' });
  const u = await repositorio.buscarPorCorreo(ALTA.correo);
  assert.strictEqual(u.versionSesion, antes + 1);
  assert.ok(u.verificadoEn);
  await assert.rejects(servicio.restablecer({ token, clave: 'otra-clave-123' }), (e) => e.estado === 400);
  await assert.rejects(servicio.ingresar(ALTA), (e) => e.estado === 401); // la vieja ya no sirve
  assert.ok(await servicio.ingresar({ correo: ALTA.correo, clave: 'clave-nueva-123' }));
});

test('recuperar: el enlace vence a la hora', async () => {
  const { servicio, correos, avanzarMin } = montar();
  await servicio.registrar(ALTA);
  await servicio.solicitarRecuperacion({ correo: ALTA.correo });
  avanzarMin(61);
  await assert.rejects(servicio.restablecer({ token: tokenDe(correos[1]), clave: 'clave-nueva-123' }), /ya venció/);
});

test('un token de verificación no sirve para restablecer (ni al revés)', async () => {
  const { servicio, correos } = montar();
  await servicio.registrar(ALTA);
  await assert.rejects(servicio.restablecer({ token: tokenDe(correos[0]), clave: 'clave-nueva-123' }), (e) => e.estado === 400);
  await servicio.solicitarRecuperacion({ correo: ALTA.correo });
  await assert.rejects(servicio.verificar({ token: tokenDe(correos[1]) }), (e) => e.estado === 400);
});

test('sesión: deSesion valida existencia y versión; cambiar la clave invalida las otras sesiones pero entrega la versión nueva', async () => {
  const { servicio } = montar();
  await servicio.registrar(ALTA);
  const u = await servicio.ingresar(ALTA);
  assert.ok(await servicio.deSesion({ sub: u.id, sv: u.versionSesion }));
  assert.strictEqual(await servicio.deSesion({ sub: 999, sv: 0 }), null);
  assert.strictEqual(await servicio.deSesion(null), null);
  assert.strictEqual(await servicio.deSesion({ sub: '1', sv: 0 }), null);
  const nuevo = await servicio.cambiarClave({ usuarioId: u.id, claveActual: ALTA.clave, claveNueva: 'clave-nueva-123' });
  assert.strictEqual(await servicio.deSesion({ sub: u.id, sv: u.versionSesion }), null);
  assert.ok(await servicio.deSesion({ sub: u.id, sv: nuevo.versionSesion }));
});

test('cambiar clave: exige la actual (403 y cuenta el fallo) y que la nueva sea distinta', async () => {
  const { servicio, repositorio } = montar();
  await servicio.registrar(ALTA);
  const u = await servicio.ingresar(ALTA);
  await assert.rejects(servicio.cambiarClave({ usuarioId: u.id, claveActual: 'no-es-la-clave', claveNueva: 'clave-nueva-123' }), (e) => e.estado === 403);
  assert.strictEqual((await repositorio.buscarPorId(u.id)).intentosFallidos, 1);
  await assert.rejects(servicio.cambiarClave({ usuarioId: u.id, claveActual: ALTA.clave, claveNueva: ALTA.clave }), (e) => e.estado === 400);
});

test('eliminar cuenta: pide la clave; borra usuario y tokens; luego no se puede ingresar', async () => {
  const { servicio, repositorio } = montar();
  await servicio.registrar(ALTA);
  const u = await servicio.ingresar(ALTA);
  await assert.rejects(servicio.eliminarCuenta({ usuarioId: u.id, clave: 'no-es-la-clave' }), (e) => e.estado === 403);
  assert.ok(await repositorio.buscarPorId(u.id));
  await servicio.eliminarCuenta({ usuarioId: u.id, clave: ALTA.clave });
  assert.strictEqual(await repositorio.buscarPorId(u.id), null);
  assert.strictEqual(repositorio.tokens.length, 0);
  await assert.rejects(servicio.ingresar(ALTA), (e) => e.estado === 401);
});
