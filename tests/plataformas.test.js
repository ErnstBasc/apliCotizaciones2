const test = require('node:test');
const assert = require('node:assert');
const { convertir, crearAdaptadorPlataforma, crearAdaptadoresPlataformas, PLATAFORMAS } = require('../src/adapters/dolarbluebolivia/plataformas');
const { combinar } = require('../src/adapters/combinar');
const { convertir: convertirWallbit, crearAdaptadorWallbit } = require('../src/adapters/dolarbluebolivia/wallbit');
const { marcarNoRefrescadas } = require('../src/services/cotizacionesService');
const { verificarAdaptador } = require('../src/contracts/adaptador');

const silencio = { error() {} };
// ---- Datos REALES de dolarbluebolivia.click (spikes 06 y 08, 31-oct-2026)
const AIRTM = { data: { currency: 'bob/usd', addValue: 12.09, withdrawValue: 11.58, source: 'rates.airtm.io', pair: 'BOB/USD', fetched_at: '2026-10-31T17:45:17.750220+00:00' }, cached: true };
const TAKENOS = { data: { currency: 'BOB', pair: 'BOB/USD', buy: 12.35, sell: 11.93, source: 'takenos', fetched_at: '2026-10-31T17:45:19.555192+00:00' }, cached: true };
const ELDORADO = { data: { source: 'eldorado', pair: 'BOB/USDT', buy: 12.1, sell: 11.93, fetched_at: '2026-10-31T18:37:52.859043+00:00' }, cached: true };
const BITGET = { data: { source: 'p2p_bitget', pair: 'BOB/USDT', buy: 12.09, sell: 12.05, fetched_at: '2026-10-31T18:36:37.463022+00:00', precio_desde: '2026-10-31T18:31:46.161152+00:00', congelado: false }, cached: true };
const WALLBIT = { data: { currency: 'BOB', buy: 12.17, sell: 11.82, source: 'wallbit', fetched_at: '2026-10-31T18:00:00.000000+00:00' } };
const POR_RUTA = { '/v1/airtm': AIRTM, '/v1/takenos': TAKENOS, '/v1/eldorado': ELDORADO, '/v1/p2p/bitget': BITGET, '/v1/wallbit': WALLBIT };

const clienteFalso = (fallan = []) => ({
  obtenerJson: async (ruta) => {
    if (fallan.includes(ruta)) throw new Error(`${ruta} respondió HTTP 500`);
    return POR_RUTA[ruta];
  },
});

test('Airtm: depositar (addValue) es la venta y retirar (withdrawValue) es la compra', () => {
  const o = convertir('airtm', AIRTM);
  assert.deepStrictEqual([o.instrumento, o.entidad, o.venta, o.compra, o.valor, o.fecha, o.estado], ['BOB_BILLETERA', 'airtm', 12.09, 11.58, 12.09, '2026-10-31', 'vigente']);
});

test('Takenos, El Dorado y Bitget: buy = venta (lo que pagas) y sell = compra (lo que recibes)', () => {
  assert.deepStrictEqual([convertir('takenos', TAKENOS).venta, convertir('takenos', TAKENOS).compra], [12.35, 11.93]);
  assert.deepStrictEqual([convertir('eldorado', ELDORADO).venta, convertir('eldorado', ELDORADO).compra], [12.1, 11.93]);
  assert.deepStrictEqual([convertir('bitget', BITGET).venta, convertir('bitget', BITGET).compra], [12.09, 12.05]);
});

test('Bitget congelado se guarda como desactualizado, no como vigente', () => {
  const o = convertir('bitget', { data: { ...BITGET.data, congelado: true } });
  assert.strictEqual(o.estado, 'desactualizado');
});

test('lados invertidos, precios absurdos, respuesta vacía o plataforma desconocida → falla', () => {
  assert.throws(() => convertir('takenos', { data: { buy: 11.93, sell: 12.35 } }), /revisar el formato/);
  assert.throws(() => convertir('airtm', { data: { addValue: 'x', withdrawValue: 11 } }), /inválidos/);
  assert.throws(() => convertir('eldorado', { data: { buy: 0.5, sell: 0.4 } }), /inválidos/);
  assert.throws(() => convertir('bitget', {}), /data/);
  assert.throws(() => convertir('noexiste', AIRTM), /desconocida/);
  assert.throws(() => crearAdaptadorPlataforma({ cliente: clienteFalso(), codigo: 'noexiste' }), /desconocida/);
});

test('cada plataforma pide su ruta y respeta el contrato de adaptador', async () => {
  const pedidas = [];
  const cliente = { obtenerJson: async (r) => { pedidas.push(r); return POR_RUTA[r]; } };
  const adaptadores = crearAdaptadoresPlataformas({ cliente });
  assert.strictEqual(adaptadores.length, Object.keys(PLATAFORMAS).length);
  for (const a of adaptadores) { verificarAdaptador(a); assert.strictEqual((await a.obtener()).length, 1); }
  assert.deepStrictEqual(pedidas.sort(), ['/v1/airtm', '/v1/eldorado', '/v1/p2p/bitget', '/v1/takenos']);
});

test('combinar: Wallbit y las 4 plataformas salen juntas en una sola lectura', async () => {
  const cliente = clienteFalso();
  const a = verificarAdaptador(combinar([crearAdaptadorWallbit({ cliente }), ...crearAdaptadoresPlataformas({ cliente })], { logger: silencio }));
  assert.strictEqual(a.nombre, 'dolarbluebolivia');
  assert.deepStrictEqual(a.instrumentos, ['BOB_BILLETERA']);
  const obs = await a.obtener();
  assert.deepStrictEqual(obs.map((o) => o.entidad).sort(), ['airtm', 'bitget', 'eldorado', 'takenos', 'wallbit']);
});

test('combinar: si una plataforma falla, las demás siguen y el fallo queda registrado', async () => {
  const cliente = clienteFalso(['/v1/takenos']);
  const registros = [];
  const a = combinar([crearAdaptadorWallbit({ cliente }), ...crearAdaptadoresPlataformas({ cliente })], { logger: { error: (m) => registros.push(m) } });
  const obs = await a.obtener();
  assert.deepStrictEqual(obs.map((o) => o.entidad).sort(), ['airtm', 'bitget', 'eldorado', 'wallbit']);
  assert.strictEqual(registros.length, 1);
  assert.match(registros[0], /takenos/);
});

test('combinar: si fallan todas → error; adaptadores de fuentes distintas o lista vacía → se rechaza', async () => {
  const cliente = clienteFalso(['/v1/wallbit', '/v1/airtm', '/v1/takenos', '/v1/eldorado', '/v1/p2p/bitget']);
  const a = combinar([crearAdaptadorWallbit({ cliente }), ...crearAdaptadoresPlataformas({ cliente })], { logger: silencio });
  await assert.rejects(a.obtener(), /fallaron todos/);
  assert.throws(() => combinar([{ nombre: 'a', instrumentos: ['X'], obtener: async () => [] }, { nombre: 'b', instrumentos: ['X'], obtener: async () => [] }]), /misma fuente/);
  assert.throws(() => combinar([]), /lista/);
});

test('una plataforma que dejó de responder queda desactualizada en la lectura siguiente', () => {
  const fila = (entidad, minutosAtras = 0) => ({ instrumento: 'BOB_BILLETERA', nombre: 'x', entidad, valor: 12, compra: 11.9, venta: 12, unidad: 'Bs por USD', fecha: '2026-10-31', estado: 'vigente', obtenidoEn: new Date(Date.parse('2026-10-31T18:00:00Z') - minutosAtras * 60_000) });
  const r = marcarNoRefrescadas([fila('wallbit'), fila('airtm'), fila('takenos', 30)]);
  assert.deepStrictEqual(r.map((o) => o.estado), ['vigente', 'vigente', 'desactualizado']);
});

test('Wallbit sigue funcionando igual (no se rompió al combinarlo)', () => {
  assert.strictEqual(convertirWallbit(WALLBIT).venta, 12.17);
});
