const test = require('node:test');
const assert = require('node:assert');
const { describir, evaluar } = require('../src/dominio/alertas');
const v = require('../src/routes/validacion');
const { crearServicioAlertas } = require('../src/services/alertasService');
const { crearRepositorioAlertas } = require('../src/repositories/alertasRepositorio');
const { manejadoresAlertas, crearRutasAlertas } = require('../src/routes/alertas');

// ---------- dominio ----------
test('describir: texto claro para cada tipo; el oficial no muestra lado', () => {
  assert.strictEqual(describir({ serie: 'paralelo', lado: 'venta', tipo: 'sube_de', umbral: 12.5 }), 'El dólar paralelo (venta) sube de 12,50 Bs');
  assert.strictEqual(describir({ serie: 'oficial', lado: 'venta', tipo: 'baja_de', umbral: 11 }), 'El dólar oficial baja de 11,00 Bs');
  assert.strictEqual(describir({ serie: 'paralelo', lado: 'compra', tipo: 'cambio_pct', umbral: 1.5 }), 'El dólar paralelo (compra) cambia más de 1,50 % en un día');
});

test('evaluar: umbrales inclusivos y cambio porcentual en ambos sentidos', () => {
  assert.strictEqual(evaluar({ tipo: 'sube_de', umbral: 12 }, { actual: 12 }).cumple, true);
  assert.strictEqual(evaluar({ tipo: 'sube_de', umbral: 12 }, { actual: 11.99 }).cumple, false);
  assert.strictEqual(evaluar({ tipo: 'baja_de', umbral: 12 }, { actual: 12 }).cumple, true);
  assert.strictEqual(evaluar({ tipo: 'baja_de', umbral: 12 }, { actual: 12.01 }).cumple, false);
  const sube = evaluar({ tipo: 'cambio_pct', umbral: 1 }, { actual: 12.2, cierreAnterior: 12 });
  assert.strictEqual(sube.cumple, true); assert.ok(Math.abs(sube.cambioPct - 1.6667) < 0.001);
  assert.strictEqual(evaluar({ tipo: 'cambio_pct', umbral: 1 }, { actual: 11.8, cierreAnterior: 12 }).cumple, true);
  assert.strictEqual(evaluar({ tipo: 'cambio_pct', umbral: 1 }, { actual: 12.05, cierreAnterior: 12 }).cumple, false);
});

test('evaluar: sin datos (actual o cierre anterior ausentes o inválidos) nunca cumple', () => {
  assert.strictEqual(evaluar({ tipo: 'sube_de', umbral: 1 }, { actual: undefined }).cumple, false);
  assert.strictEqual(evaluar({ tipo: 'baja_de', umbral: 99 }, { actual: NaN }).cumple, false);
  for (const cierreAnterior of [null, undefined, 0, -3]) assert.strictEqual(evaluar({ tipo: 'cambio_pct', umbral: 1 }, { actual: 12, cierreAnterior }).cumple, false);
});

// ---------- validación ----------
test('validarAlerta: datos correctos; el oficial fuerza lado venta; el umbral se redondea a 2 decimales', () => {
  assert.deepStrictEqual(v.validarAlerta({ serie: 'paralelo', lado: 'compra', tipo: 'sube_de', umbral: 12.505 }), { serie: 'paralelo', lado: 'compra', tipo: 'sube_de', umbral: 12.51 });
  assert.deepStrictEqual(v.validarAlerta({ serie: 'oficial', lado: 'compra', tipo: 'baja_de', umbral: 11 }), { serie: 'oficial', lado: 'venta', tipo: 'baja_de', umbral: 11 });
  assert.strictEqual(v.validarAlerta({ serie: 'paralelo', tipo: 'cambio_pct', umbral: 2 }).lado, 'venta');
});

test('validarAlerta: rechaza series, tipos, lados y umbrales fuera de lo permitido (incluidos textos y valores raros)', () => {
  const ok = { serie: 'paralelo', tipo: 'sube_de', umbral: 12 };
  for (const cambio of [{ serie: 'bancos' }, { serie: undefined }, { tipo: 'otro' }, { lado: 'medio' }, { umbral: '12' }, { umbral: null }, { umbral: NaN }, { umbral: Infinity },
    { umbral: 0 }, { umbral: -1 }, { umbral: 1001 }, { tipo: 'cambio_pct', umbral: 51 }, { tipo: 'cambio_pct', umbral: 0.01 }]) {
    assert.throws(() => v.validarAlerta({ ...ok, ...cambio }), (e) => e.estado === 400, JSON.stringify(cambio));
  }
  assert.throws(() => v.validarAlerta(null), /objeto JSON/);
});

test('validarActiva e id de alerta', () => {
  assert.deepStrictEqual(v.validarActiva({ activa: false }), { activa: false });
  for (const mal of [{ activa: 'si' }, { activa: 1 }, {}]) assert.throws(() => v.validarActiva(mal));
  assert.strictEqual(v.validarIdAlerta({ id: '42' }), 42);
  for (const mal of ['0x1', '-1', '1e3', '', "1; DROP", '1'.repeat(16), undefined]) assert.throws(() => v.validarIdAlerta({ id: mal }), mal);
});

// ---------- repositorio ----------
function dbFalsa(filas = [], rowCount = filas.length) {
  const db = { llamadas: [] };
  db.query = async (sql, params) => { db.llamadas.push({ sql, params }); return { rows: filas, rowCount }; };
  return db;
}
const FILA = { id: '3', usuario_id: '9', serie: 'paralelo', lado: 'venta', tipo: 'sube_de', umbral: '12.50', activa: true, ultimo_aviso_en: null, creada_en: '2026-11-01T15:00:00Z' };

test('repositorio: SQL parametrizado, el tope va dentro de la sentencia y los tipos se convierten', async () => {
  const db = dbFalsa([FILA]);
  const repo = crearRepositorioAlertas(db);
  const a = await repo.crear({ usuarioId: 9, serie: 'paralelo', lado: 'venta', tipo: 'sube_de', umbral: 12.5, maximo: 3 });
  assert.deepStrictEqual([a.id, a.usuarioId, a.umbral, a.ultimoAvisoEn], [3, 9, 12.5, null]);
  assert.match(db.llamadas[0].sql, /COUNT\(\*\) FROM alertas WHERE usuario_id = \$1\) < \$6/);
  assert.deepStrictEqual(db.llamadas[0].params, [9, 'paralelo', 'venta', 'sube_de', 12.5, 3]);
  assert.strictEqual(await crearRepositorioAlertas(dbFalsa([])).crear({ usuarioId: 9, serie: 'oficial', lado: 'venta', tipo: 'baja_de', umbral: 1, maximo: 3 }), null);
});

test('repositorio: modificar y borrar exigen el usuario dueño; reclamar aviso compara contra la hora de espera', async () => {
  const db = dbFalsa([FILA]);
  const repo = crearRepositorioAlertas(db);
  await repo.cambiarActiva({ usuarioId: 9, id: 3, activa: false });
  await repo.eliminar({ usuarioId: 9, id: 3 });
  assert.match(db.llamadas[0].sql, /WHERE id = \$2 AND usuario_id = \$1/);
  assert.match(db.llamadas[1].sql, /WHERE id = \$2 AND usuario_id = \$1/);
  const ahora = new Date(); const espera = new Date(ahora - 1000);
  assert.strictEqual(await repo.reclamarAviso({ id: 3, ahora, esperaHasta: espera }), true);
  assert.match(db.llamadas[2].sql, /ultimo_aviso_en IS NULL OR ultimo_aviso_en <= \$3/);
  assert.strictEqual(await crearRepositorioAlertas(dbFalsa([], 0)).reclamarAviso({ id: 3, ahora, esperaHasta: espera }), false);
  const r = await crearRepositorioAlertas(dbFalsa([{ ...FILA, correo: 'a@b.co' }])).activasConCorreo();
  assert.strictEqual(r[0].correo, 'a@b.co');
});

test('repositorio: las alertas para avisar solo salen de usuarios con correo confirmado', async () => {
  const db = dbFalsa([]);
  await crearRepositorioAlertas(db).activasConCorreo();
  assert.match(db.llamadas[0].sql, /verificado_en IS NOT NULL/);
  assert.match(db.llamadas[0].sql, /a\.activa/);
});

// ---------- servicio ----------
function repoMemoria() {
  const filas = []; let sig = 1;
  return {
    async crear({ usuarioId, maximo, ...d }) {
      if (filas.filter((f) => f.usuarioId === usuarioId).length >= maximo) return null;
      const f = { id: sig++, usuarioId, activa: true, ultimoAvisoEn: null, creadaEn: new Date(), ...d }; filas.push(f); return { ...f };
    },
    async listar(u) { return filas.filter((f) => f.usuarioId === u).map((f) => ({ ...f })); },
    async cambiarActiva({ usuarioId, id, activa }) { const f = filas.find((x) => x.id === id && x.usuarioId === usuarioId); if (f) f.activa = activa; return f ? { ...f } : null; },
    async eliminar({ usuarioId, id }) { const i = filas.findIndex((x) => x.id === id && x.usuarioId === usuarioId); if (i >= 0) filas.splice(i, 1); return i >= 0; },
  };
}
const DATOS = { serie: 'paralelo', lado: 'venta', tipo: 'sube_de', umbral: 12.5 };

test('servicio: tope de 3 alertas por usuario (409), independiente entre usuarios', async () => {
  const s = crearServicioAlertas({ repositorio: repoMemoria(), maximoPorUsuario: 3, enfriamientoHoras: 12 });
  for (let i = 0; i < 3; i++) await s.crear(1, DATOS);
  await assert.rejects(s.crear(1, DATOS), (e) => e.estado === 409 && /Ya tienes 3 alertas/.test(e.message));
  assert.ok(await s.crear(2, DATOS));
  const l = await s.listar(1);
  assert.strictEqual(l.alertas.length, 3); assert.strictEqual(l.maximo, 3); assert.strictEqual(l.enfriamientoHoras, 12);
  assert.strictEqual(l.alertas[0].descripcion, 'El dólar paralelo (venta) sube de 12,50 Bs');
  assert.ok(!('usuarioId' in l.alertas[0]));
});

test('servicio: nadie toca las alertas de otro usuario (404)', async () => {
  const s = crearServicioAlertas({ repositorio: repoMemoria(), maximoPorUsuario: 3, enfriamientoHoras: 12 });
  const a = await s.crear(1, DATOS);
  await assert.rejects(s.cambiarActiva(2, a.id, false), (e) => e.estado === 404);
  await assert.rejects(s.eliminar(2, a.id), (e) => e.estado === 404);
  assert.strictEqual((await s.cambiarActiva(1, a.id, false)).activa, false);
  await s.eliminar(1, a.id);
  assert.strictEqual((await s.listar(1)).alertas.length, 0);
});

// ---------- rutas ----------
function resFalsa() { const r = { cab: {} }; r.setHeader = (k, x) => { r.cab[k] = x; }; r.json = (c) => { r.cuerpo = c; }; return r; }

test('rutas: usan el usuario de la sesión, validan y mandan los errores a next', async () => {
  const s = crearServicioAlertas({ repositorio: repoMemoria(), maximoPorUsuario: 3, enfriamientoHoras: 12 });
  const h = manejadoresAlertas(s);
  const req = { usuario: { id: 7 }, body: DATOS };
  const res = resFalsa(); await h.crear(req, res, (e) => { throw e; });
  assert.strictEqual(res.cuerpo.alerta.umbral, 12.5);
  const lista = resFalsa(); await h.listar(req, lista, (e) => { throw e; });
  assert.strictEqual(lista.cuerpo.alertas.length, 1); assert.strictEqual(lista.cab['Cache-Control'], 'no-store');
  let err; await h.crear({ usuario: { id: 7 }, body: { ...DATOS, umbral: 'x' } }, resFalsa(), (e) => { err = e; });
  assert.strictEqual(err.estado, 400);
  await h.cambiar({ usuario: { id: 7 }, params: { id: '1' }, body: { activa: false } }, res, (e) => { throw e; });
  assert.strictEqual(res.cuerpo.alerta.activa, false);
  await h.eliminar({ usuario: { id: 7 }, params: { id: '999' } }, resFalsa(), (e) => { err = e; });
  assert.strictEqual(err.estado, 404);
});

test('rutas: el router aplica origen + sesión + correo verificado antes de todo', () => {
  const usados = []; const rutas = [];
  const router = { use: (...f) => usados.push(...f), get: (p) => rutas.push(`GET ${p}`), post: (p) => rutas.push(`POST ${p}`), patch: (p) => rutas.push(`PATCH ${p}`), delete: (p) => rutas.push(`DELETE ${p}`) };
  const guardias = { exigirSesion() {}, exigirVerificado() {} }; const mismoOrigen = () => {};
  crearRutasAlertas({ Router: () => router }, { alertas: {}, autenticacion: guardias, mismoOrigen });
  assert.deepStrictEqual(usados, [mismoOrigen, guardias.exigirSesion, guardias.exigirVerificado]);
  assert.deepStrictEqual(rutas.sort(), ['DELETE /:id', 'GET /', 'PATCH /:id', 'POST /']);
});
