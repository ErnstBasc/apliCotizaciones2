const test = require('node:test');
const assert = require('node:assert');
const { convertir: convertirWallbit, crearAdaptadorWallbit } = require('../src/adapters/dolarbluebolivia/wallbit');
const { convertir: convertirBancos, crearAdaptadorBancos } = require('../src/adapters/dolarbluebolivia/bancos');
const { marcarNoRefrescadas, resumirBancos } = require('../src/services/cotizacionesService');
const { manejadorBancos, manejadorBilleteras } = require('../src/routes/entidades');
const { verificarAdaptador } = require('../src/contracts/adaptador');

const silencio = { error() {} };
// ---- Datos REALES (Paso 0, 25-oct-2026)
const WALLBIT_REAL = { data: { currency: 'BOB', buy: 12.17, sell: 11.82, source: 'wallbit', fetched_at: '2026-10-25T19:49:44.706055+00:00' } };
const pz = (compra, venta, estado = 'vigente', fecha = '2026-10-25') => ({ pizarra: { compra, venta, estado, fecha } });
const BANCOS_REAL = { data: { bancos: [
  { id: 'fie', nombre: 'Banco FIE', ...pz(10.98, 11.98) },
  { id: 'bisa', nombre: 'Banco Bisa', ...pz(11.18, 12.1) },
  { id: 'bcp', nombre: 'BCP', ...pz(11.38, 12.18) },
  { id: 'bnb', nombre: 'BNB', ...pz(11.38, 12.18) },
  { id: 'fortaleza', nombre: 'Banco Fortaleza', ...pz(11.58, 12.18) },
  { id: 'ganadero', nombre: 'Banco Ganadero', ...pz(null, 12.18) },
  { id: 'union', nombre: 'Banco Unión', ...pz(10.38, 12.18) },
  { id: 'bancosol', nombre: 'BancoSol', ...pz(10.69, 12.18) },
  { id: 'mercantil', nombre: 'Mercantil Santa Cruz', ...pz(10.78, 12.18) },
  { id: 'economico', nombre: 'Banco Económico', ...pz(10.88, 12.23) },
  { id: 'prodem', nombre: 'Banco Prodem', ...pz(11.45, 11.85, 'desactualizado', '2026-10-22') },
  { id: 'ecofuturo', nombre: 'Banco Ecofuturo', ...pz(null, null, 'no_leido', null) },
  { id: 'pyme-comunidad', nombre: 'Banco PyME de la Comunidad', ...pz(null, null, 'no_leido', null) },
] } };

test('Wallbit: normaliza a la convención (venta = lo que pagas = 12,17; compra = 11,82)', () => {
  const o = convertirWallbit(WALLBIT_REAL);
  assert.deepStrictEqual([o.entidad, o.venta, o.compra, o.valor, o.fecha], ['wallbit', 12.17, 11.82, 12.17, '2026-10-25']);
});

test('Wallbit: lados invertidos, precios absurdos o respuesta vacía → falla', () => {
  assert.throws(() => convertirWallbit({ data: { buy: 11.82, sell: 12.17 } }), /revisar el formato/);
  assert.throws(() => convertirWallbit({ data: { buy: 'x', sell: 12 } }), /inválidos/);
  assert.throws(() => convertirWallbit({}), /data/);
});

test('Wallbit: respeta el contrato de adaptador', async () => {
  const a = crearAdaptadorWallbit({ cliente: { obtenerJson: async (r) => { assert.strictEqual(r, '/v1/wallbit'); return WALLBIT_REAL; } } });
  verificarAdaptador(a);
  assert.strictEqual((await a.obtener()).length, 1);
});

test('Bancos: 11 con precio; omite los no leídos; Prodem queda desactualizado; Ganadero sin compra', () => {
  const obs = convertirBancos(BANCOS_REAL, silencio);
  assert.strictEqual(obs.length, 11);
  assert.ok(!obs.some((o) => o.entidad === 'ecofuturo'));
  assert.strictEqual(obs.find((o) => o.entidad === 'prodem').estado, 'desactualizado');
  assert.strictEqual(obs.find((o) => o.entidad === 'prodem').fecha, '2026-10-22');
  const g = obs.find((o) => o.entidad === 'ganadero');
  assert.deepStrictEqual([g.compra, g.venta, g.valor], [null, 12.18, 12.18]);
});

test('Bancos: un banco desconocido se omite y se registra; formato roto o sin precios → falla', () => {
  const registros = [];
  const json = { data: { bancos: [{ id: 'nuevo', ...pz(11, 12) }, { id: 'fie', ...pz(10.98, 11.98) }] } };
  assert.strictEqual(convertirBancos(json, { error: (m) => registros.push(m) }).length, 1);
  assert.ok(registros[0].includes('nuevo'));
  assert.throws(() => convertirBancos({ data: {} }, silencio), /data.bancos/);
  assert.throws(() => convertirBancos({ data: { bancos: [{ id: 'ecofuturo', ...pz(null, null, 'no_leido') }] } }, silencio), /ningún banco/);
  assert.strictEqual(convertirBancos({ data: { bancos: [{ id: 'fie', ...pz(0.5, 999) }, { id: 'bisa', ...pz(11, 12) }] } }, silencio).length, 1); // precios absurdos → sin precio útil
});

test('Bancos: respeta el contrato de adaptador', async () => {
  const a = crearAdaptadorBancos({ cliente: { obtenerJson: async () => BANCOS_REAL }, logger: silencio });
  verificarAdaptador(a);
  assert.strictEqual((await a.obtener()).length, 11);
});

const fila = (entidad, compra, venta, minutosAtras = 0, estado = 'vigente') => ({
  instrumento: 'BOB_BANCO', nombre: 'Dólar en bancos', entidad, valor: venta, compra, venta, unidad: 'Bs por USD',
  fecha: '2026-10-25', estado, obtenidoEn: new Date(Date.parse('2026-10-25T20:00:00Z') - minutosAtras * 60_000),
});

test('resumen de bancos con datos reales: más barato FIE (11,98); mejor para vender Fortaleza (11,58)', () => {
  const obs = convertirBancos(BANCOS_REAL, silencio).map((o) => ({ ...o, nombre: 'x', obtenidoEn: new Date() }));
  const r = resumirBancos(obs);
  assert.deepStrictEqual(r.resumen.mejor_para_comprar, { entidad: 'fie', venta: 11.98 });
  assert.deepStrictEqual(r.resumen.mejor_para_vender, { entidad: 'fortaleza', compra: 11.58 });
  assert.strictEqual(r.resumen.bancos_con_precio, 10); // Prodem (desactualizado) no cuenta
  assert.strictEqual(r.bancos[0].entidad, 'fie'); // vigentes primero, por venta ascendente
  assert.strictEqual(r.bancos[r.bancos.length - 1].entidad, 'prodem'); // el desactualizado va al final aunque su venta (11,85) sea menor
});

test('una fila que no se refrescó con las demás pasa a desactualizada', () => {
  const r = marcarNoRefrescadas([fila('fie', 10.98, 11.98), fila('bisa', 11.18, 12.1), fila('viejo', 11, 12, 120)]);
  assert.deepStrictEqual(r.map((o) => o.estado), ['vigente', 'vigente', 'desactualizado']);
  assert.deepStrictEqual(marcarNoRefrescadas([]), []);
});

test('/bancos y /billeteras: forma de la respuesta', async () => {
  const servicio = {
    bancos: async () => ({ origen: 'cache', desactualizado: false, ...resumirBancos([fila('fie', 10.98, 11.98), fila('bisa', 11.18, 12.1)]) }),
    billeteras: async () => ({ origen: 'dolarbluebolivia', desactualizado: false, observaciones: [{ ...fila('wallbit', 11.82, 12.17), instrumento: 'BOB_BILLETERA' }] }),
  };
  let res = { json(c) { this.cuerpo = c; } };
  await manejadorBancos(servicio)({}, res, () => {});
  assert.strictEqual(res.cuerpo.bancos[0].codigo, 'BOB_BANCO');
  assert.strictEqual(res.cuerpo.resumen.mejor_para_comprar.entidad, 'fie');
  assert.ok(res.cuerpo.aviso.includes('pizarra'));
  res = { json(c) { this.cuerpo = c; } };
  await manejadorBilleteras(servicio)({}, res, () => {});
  assert.deepStrictEqual([res.cuerpo.billeteras[0].venta, res.cuerpo.billeteras[0].compra], [12.17, 11.82]);
});
