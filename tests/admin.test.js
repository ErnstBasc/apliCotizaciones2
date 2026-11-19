const test = require('node:test');
const assert = require('node:assert');
const v = require('../src/routes/validacion');
const { crearRutasAdmin, manejadoresAdmin } = require('../src/routes/admin');
const { crearAutenticacion, mismoOrigen } = require('../src/middleware/autenticacion');
const { crearSesiones } = require('../src/utilidades/sesiones');
const { crearServicioUsuarios } = require('../src/services/usuariosService');
const { crearServicioAdministradores } = require('../src/services/administradoresService');
const { crearServicioEstadisticas, fechasEntre } = require('../src/services/estadisticasService');
const { crearMedidor, clasificar, compilarRutas } = require('../src/middleware/medicion');
const { crearRepositorioFalso, clavesFalsas } = require('./ayudas/usuariosFalso');
const especificacion = require('../src/docs');

const SECRETO = 's'.repeat(40);
const AHORA = new Date('2026-11-19T16:00:00Z'); // 12:00 en La Paz

// ---------- validación ----------
test('validación de estadísticas: período 7, 30 o 90 días (30 por defecto); nada más', () => {
  assert.deepStrictEqual(v.validarEstadisticas({}), { dias: 30 });
  assert.deepStrictEqual(v.validarEstadisticas({ dias: '7' }), { dias: 7 });
  assert.deepStrictEqual(v.validarEstadisticas({ dias: '90' }), { dias: 90 });
  for (const malo of ['0', '15', '180', '30abc', '1e2', '-7', '', ['7', '30']]) assert.throws(() => v.validarEstadisticas({ dias: malo }), /dias/, String(malo));
});

// ---------- guardias: sesión + administrador ----------
async function entorno() {
  const repositorio = crearRepositorioFalso();
  const usuarios = crearServicioUsuarios({ repositorio, claves: clavesFalsas, urlPublica: 'http://sitio.test', mailer: { enviar: async () => {} }, logger: { error() {} } });
  const sesiones = crearSesiones({ secreto: SECRETO });
  const autenticacion = crearAutenticacion({ sesiones, usuarios });
  const admins = crearServicioAdministradores({ repositorio, claves: clavesFalsas, ahora: () => AHORA });
  return { repositorio, usuarios, sesiones, autenticacion, admins };
}
// Pasa una petición por exigirSesion y exigirAdmin; devuelve el error (o undefined si pasó)
async function recorrer({ sesiones, autenticacion }, usuario) {
  const res = { cabeceras: {}, setHeader(k, v2) { this.cabeceras[k] = v2; }, cookie() {}, clearCookie() {} };
  const req = { headers: {}, cookies: {} };
  if (usuario) { sesiones.emitir(res, usuario); }
  const galleta = usuario ? (res.cabeceras['Set-Cookie'] || res.cabeceras['set-cookie']) : null;
  if (galleta) req.headers.cookie = String([].concat(galleta)[0]).split(';')[0];
  let error;
  await autenticacion.exigirSesion(req, res, (e) => { error = e; });
  if (error) return error;
  autenticacion.exigirAdmin(req, res, (e) => { error = e; });
  return error;
}

test('exigirAdmin: sin sesión 401; usuario común 403; administrador pasa', async () => {
  const e = await entorno();
  assert.strictEqual((await recorrer(e, null)).estado, 401);

  const comun = await e.repositorio.crear({ correo: 'ana@ejemplo.com', claveHash: 'hash:x' });
  await e.repositorio.marcarVerificado(comun.id, AHORA);
  const errorComun = await recorrer(e, { ...(await e.usuarios.deSesion({ sub: comun.id, sv: 0 })) });
  assert.strictEqual(errorComun.estado, 403);
  assert.match(errorComun.message, /administradores/);

  const admin = await e.admins.crear({ correo: 'jefe@ejemplo.com', clave: 'clave-de-admin-123' });
  const entrante = await e.usuarios.deSesion({ sub: admin.id, sv: 0 });
  assert.strictEqual(await recorrer(e, entrante), undefined);
});

test('exigirAdmin: el rol se lee de la base en cada petición; al quitarlo, la sesión abierta deja de servir', async () => {
  const e = await entorno();
  const admin = await e.admins.crear({ correo: 'jefe@ejemplo.com', clave: 'clave-de-admin-123' });
  const entrante = await e.usuarios.deSesion({ sub: admin.id, sv: 0 });
  assert.strictEqual(await recorrer(e, entrante), undefined);
  assert.strictEqual(await e.admins.quitar({ correo: 'jefe@ejemplo.com' }), true);
  // la sesión anterior ya no es válida (la versión de sesión subió) → 401 ; y aunque se reemitiera, el rol ya no es admin
  assert.strictEqual((await recorrer(e, entrante)).estado, 401);
  const comun = await e.usuarios.deSesion({ sub: admin.id, sv: 1 });
  assert.strictEqual((await recorrer(e, comun)).estado, 403);
});

test('exigirAdmin: un administrador con el correo sin confirmar tampoco pasa', () => {
  const { exigirAdmin } = crearAutenticacion({ sesiones: {}, usuarios: {} });
  let error; exigirAdmin({ usuario: { rol: 'admin', verificado: false } }, {}, (x) => { error = x; });
  assert.strictEqual(error.estado, 403);
  error = undefined; exigirAdmin({ usuario: { rol: 'admin', verificado: true } }, {}, (x) => { error = x; });
  assert.strictEqual(error, undefined);
});

// ---------- ruta ----------
test('la ruta /admin/estadisticas se protege en este orden: mismo origen, sesión, administrador', () => {
  const llamadas = { use: [], get: [] };
  const falsoRouter = { use: (...m) => llamadas.use.push(m), get: (ruta, ...m) => llamadas.get.push([ruta, m]) };
  const autenticacion = { exigirSesion: () => {}, exigirAdmin: () => {} };
  crearRutasAdmin({ Router: () => falsoRouter }, { estadisticas: {}, autenticacion, mismoOrigen });
  assert.deepStrictEqual(llamadas.use[0], [mismoOrigen, autenticacion.exigirSesion, autenticacion.exigirAdmin]);
  assert.strictEqual(llamadas.get[0][0], '/estadisticas');
});

test('el manejador valida el período, pide el resumen y responde sin caché', async () => {
  const pedidos = [];
  const h = manejadoresAdmin({ resumen: async (p) => { pedidos.push(p); return { ok: true }; } });
  const res = { cabeceras: {}, setHeader(k, x) { this.cabeceras[k] = x; }, json(c) { this.cuerpo = c; } };
  await h.estadisticas({ query: { dias: '7' } }, res, (e) => { throw e; });
  assert.deepStrictEqual(pedidos, [{ dias: 7 }]);
  assert.strictEqual(res.cabeceras['Cache-Control'], 'no-store');
  let error; await h.estadisticas({ query: { dias: '5' } }, res, (e) => { error = e; });
  assert.strictEqual(error.estado, 400);
});

// ---------- administradores ----------
test('crear administrador: normaliza el correo, exige clave de 12+ y lo deja verificado', async () => {
  const e = await entorno();
  const r = await e.admins.crear({ correo: ' Jefe@Ejemplo.COM ', clave: 'clave-de-admin-123' });
  assert.deepStrictEqual({ correo: r.correo, rol: r.rol }, { correo: 'jefe@ejemplo.com', rol: 'admin' });
  assert.ok(e.repositorio.usuarios.get(r.id).verificadoEn);
  await assert.rejects(() => e.admins.crear({ correo: 'otro@ejemplo.com', clave: 'corta-11-ch' }), /entre 12 y 128/);
  await assert.rejects(() => e.admins.crear({ correo: 'sin-arroba', clave: 'clave-de-admin-123' }), /correo/);
});

test('crear administrador sobre una cuenta existente: la promueve, cambia su clave y cierra sus sesiones', async () => {
  const e = await entorno();
  const u = await e.repositorio.crear({ correo: 'ana@ejemplo.com', claveHash: 'hash:vieja-clave-1' });
  const r = await e.admins.crear({ correo: 'ana@ejemplo.com', clave: 'clave-de-admin-123' });
  assert.strictEqual(r.id, u.id);
  const guardado = e.repositorio.usuarios.get(u.id);
  assert.strictEqual(guardado.rol, 'admin');
  assert.strictEqual(guardado.claveHash, 'hash:clave-de-admin-123');
  assert.strictEqual(guardado.versionSesion, 1);
  assert.strictEqual(await e.usuarios.deSesion({ sub: u.id, sv: 0 }), null); // la sesión vieja ya no sirve
});

test('quitar administrador: false si no lo era', async () => {
  const e = await entorno();
  await e.repositorio.crear({ correo: 'ana@ejemplo.com', claveHash: 'x' });
  assert.strictEqual(await e.admins.quitar({ correo: 'ana@ejemplo.com' }), false);
});

test('la cuenta de administrador no se puede eliminar desde la página (ni con la clave correcta)', async () => {
  const e = await entorno();
  const admin = await e.admins.crear({ correo: 'jefe@ejemplo.com', clave: 'clave-de-admin-123' });
  await assert.rejects(() => e.usuarios.eliminarCuenta({ usuarioId: admin.id, clave: 'clave-de-admin-123' }), (err) => err.estado === 403 && /administrador/.test(err.message));
  assert.ok(e.repositorio.usuarios.has(admin.id));
});

test('el login de un administrador es el de siempre: mismo mensaje de error y mismo bloqueo', async () => {
  const e = await entorno();
  await e.admins.crear({ correo: 'jefe@ejemplo.com', clave: 'clave-de-admin-123' });
  const entrante = await e.usuarios.ingresar({ correo: 'jefe@ejemplo.com', clave: 'clave-de-admin-123' });
  assert.strictEqual(entrante.rol, 'admin');
  for (let i = 0; i < 5; i++) await assert.rejects(() => e.usuarios.ingresar({ correo: 'jefe@ejemplo.com', clave: 'mala' }), /incorrectos/);
  await assert.rejects(() => e.usuarios.ingresar({ correo: 'jefe@ejemplo.com', clave: 'clave-de-admin-123' }), (err) => err.estado === 429);
});

// ---------- resumen de estadísticas ----------
function repoEstadisticasFalso(extra = {}) {
  return {
    usuarios: async () => ({ total: 10, verificados: 8, porRol: { registrado: 9, premium: 0, admin: 1 } }),
    altasPorDia: async () => [{ fecha: '2026-11-18', total: 2 }, { fecha: '2026-11-19', total: 1 }],
    alertas: async () => ({ total: 5, activas: 4 }),
    avisos: async () => ({ total: 7, enPeriodo: 3 }),
    usoPorDia: async () => [
      { fecha: '2026-11-18', tipo: 'peticion', total: 100 }, { fecha: '2026-11-19', tipo: 'peticion', total: 40 }, { fecha: '2026-11-19', tipo: 'descarga', total: 2 },
    ],
    usoPorRuta: async () => [{ ruta: '/cotizaciones', total: 90 }],
    primerDiaDeUso: async () => '2026-11-18',
    datos: async () => ({ cotizaciones: 500, ultimaObtencion: '2026-11-19T15:50:00.000Z', porFuente: [{ fuente: 'Binance P2P (no oficial)', total: 300 }] }),
    ...extra,
  };
}

test('resumen: período con días sin datos en cero, totales sumados y rango en hora de Bolivia', async () => {
  const s = crearServicioEstadisticas({ repositorio: repoEstadisticasFalso(), ahora: () => AHORA });
  const r = await s.resumen({ dias: 7 });
  assert.deepStrictEqual(r.periodo, { dias: 7, desde: '2026-11-13', hasta: '2026-11-19' });
  assert.strictEqual(r.uso.porDia.length, 7);
  assert.deepStrictEqual(r.uso.porDia[0], { fecha: '2026-11-13', peticiones: 0, descargas: 0 });
  assert.deepStrictEqual(r.uso.porDia[6], { fecha: '2026-11-19', peticiones: 40, descargas: 2 });
  assert.strictEqual(r.uso.peticiones, 140);
  assert.strictEqual(r.uso.descargas, 2);
  assert.strictEqual(r.uso.medidoDesde, '2026-11-18');
  assert.strictEqual(r.usuarios.altasEnPeriodo, 3);
  assert.deepStrictEqual(r.usuarios.altasPorDia.map((d) => d.total), [0, 0, 0, 0, 0, 2, 1]);
  assert.deepStrictEqual(r.alertas, { total: 5, activas: 4, avisosEnviados: 7, avisosEnPeriodo: 3 });
  assert.strictEqual(r.datos.cotizaciones, 500);
});

test('resumen: SOLO totales; no sale ningún correo ni hash', async () => {
  const s = crearServicioEstadisticas({ repositorio: repoEstadisticasFalso(), ahora: () => AHORA });
  const texto = JSON.stringify(await s.resumen());
  assert.ok(!/@|hash|clave/i.test(texto));
});

test('fechasEntre: ambos extremos incluidos, también cruzando el fin de mes', () => {
  assert.deepStrictEqual(fechasEntre('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepStrictEqual(fechasEntre('2026-11-19', '2026-11-19'), ['2026-11-19']);
});

// ---------- medidor de uso ----------
const PATRONES = compilarRutas(Object.keys(especificacion.paths));

test('clasificar: rutas reales con su nombre; lo desconocido va a "(otras)" (los contadores no pueden crecer sin límite)', () => {
  assert.strictEqual(clasificar('/alertas/15', PATRONES), '/alertas/:id');
  assert.strictEqual(clasificar('/historico.csv?dias=7&formato=excel', PATRONES), '/historico.csv');
  assert.strictEqual(clasificar('/alertas/', PATRONES), '/alertas');
  for (const rara of ['/nada', '/alertas/1/2', '/historico.csvx', '/%00', `/${'a'.repeat(5000)}`]) assert.strictEqual(clasificar(rara, PATRONES), '(otras)', rara);
});

function peticion(medidor, { url, estado = 200 }) {
  const oyentes = {};
  const req = { originalUrl: url };
  const res = { statusCode: estado, on: (evento, fn) => { oyentes[evento] = fn; } };
  let siguio = false;
  medidor.middleware(req, res, () => { siguio = true; });
  if (oyentes.finish) oyentes.finish();
  return siguio;
}

test('medidor: cuenta peticiones por día y ruta; la descarga cuenta solo si se entregó (200); /admin y /health no cuentan', async () => {
  const guardado = [];
  const m = crearMedidor({ repositorio: { sumarUso: async (x) => { guardado.push(x); } }, rutasConocidas: Object.keys(especificacion.paths), ahora: () => AHORA });
  assert.strictEqual(peticion(m, { url: '/cotizaciones' }), true); // siempre deja seguir
  peticion(m, { url: '/cotizaciones?x=1' });
  peticion(m, { url: '/historico.csv?dias=7' });
  peticion(m, { url: '/historico.csv', estado: 403 });
  peticion(m, { url: '/admin/estadisticas' });
  peticion(m, { url: '/health' });
  peticion(m, { url: '/ruta-inventada-1' });
  peticion(m, { url: '/ruta-inventada-2' });
  assert.strictEqual(await m.volcar(), 4); // 4 contadores: cotizaciones, csv, descarga, otras
  const por = (tipo, ruta) => guardado.find((g) => g.tipo === tipo && g.ruta === ruta);
  assert.strictEqual(por('peticion', '/cotizaciones').total, 2);
  assert.strictEqual(por('peticion', '/historico.csv').total, 2);
  assert.strictEqual(por('descarga', '/historico.csv').total, 1);
  assert.strictEqual(por('peticion', '(otras)').total, 2);
  assert.ok(!guardado.some((g) => /admin|health/.test(g.ruta)));
  assert.ok(guardado.every((g) => g.dia === '2026-11-19'));
  assert.strictEqual(m.pendientes(), 0);
});

test('medidor: el día cambia a medianoche de Bolivia (04:00 UTC), no a medianoche UTC', async () => {
  let ahora = new Date('2026-11-19T03:59:00Z'); // 23:59 del 18 en La Paz
  const guardado = [];
  const m = crearMedidor({ repositorio: { sumarUso: async (x) => { guardado.push(x); } }, rutasConocidas: ['/cotizaciones'], ahora: () => ahora });
  peticion(m, { url: '/cotizaciones' });
  ahora = new Date('2026-11-19T04:01:00Z');
  peticion(m, { url: '/cotizaciones' });
  await m.volcar();
  assert.deepStrictEqual(guardado.map((g) => g.dia).sort(), ['2026-11-18', '2026-11-19']);
});

test('medidor: si la base falla, los contadores se conservan y se guardan en el siguiente volcado', async () => {
  let cae = true; const guardado = []; const avisos = [];
  const m = crearMedidor({
    repositorio: { sumarUso: async (x) => { if (cae) throw new Error('base caída'); guardado.push(x); } },
    rutasConocidas: ['/cotizaciones'], ahora: () => AHORA, logger: { error: (t) => avisos.push(t) },
  });
  peticion(m, { url: '/cotizaciones' }); peticion(m, { url: '/cotizaciones' });
  assert.strictEqual(await m.volcar(), 0);
  assert.strictEqual(m.pendientes(), 1);
  assert.match(avisos[0], /base caída/);
  peticion(m, { url: '/cotizaciones' }); // sigue contando mientras tanto
  cae = false;
  assert.strictEqual(await m.volcar(), 1);
  assert.strictEqual(guardado[0].total, 3); // nada se perdió
});

test('medidor: iniciar programa el volcado periódico sin bloquear el cierre; detener vuelca lo pendiente', async () => {
  let tarea = null; let cancelado = false; const guardado = [];
  const m = crearMedidor({
    repositorio: { sumarUso: async (x) => { guardado.push(x); } }, rutasConocidas: ['/cotizaciones'], ahora: () => AHORA,
    programar: (fn, ms) => { tarea = { fn, ms, unref() { this.sinBloqueo = true; } }; return tarea; }, cancelar: () => { cancelado = true; },
  });
  m.iniciar(); m.iniciar(); // dos veces no crea dos relojes
  assert.strictEqual(tarea.ms, 30_000);
  assert.ok(tarea.sinBloqueo);
  peticion(m, { url: '/cotizaciones' });
  await m.detener();
  assert.ok(cancelado);
  assert.strictEqual(guardado.length, 1);
});

// ---------- documentación y esquema ----------
test('la documentación declara /admin/estadisticas como protegida, con 401 y 403', () => {
  const op = especificacion.paths['/admin/estadisticas'].get;
  assert.deepStrictEqual(op.security, [{ sesion: [] }]);
  assert.ok(op.responses[401] && op.responses[403] && op.responses[400]);
  assert.deepStrictEqual(op.parameters[0].schema.enum, [7, 30, 90]);
});
