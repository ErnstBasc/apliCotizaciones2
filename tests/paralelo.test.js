const test = require('node:test');
const assert = require('node:assert');
const { crearAdaptadorBinance, precios } = require('../src/adapters/binance');
const { convertir, crearAdaptadorParaleloRespaldo } = require('../src/adapters/dolarbluebolivia/paralelo');
const { conRespaldo } = require('../src/adapters/conRespaldo');
const { mediana } = require('../src/utilidades/estadistica');
const { fechaBolivia } = require('../src/utilidades/fechas');
const { crearServicioCache } = require('../src/services/cacheService');
const { verificarAdaptador } = require('../src/contracts/adaptador');
const { manejadorParalelo } = require('../src/routes/fuentes');

// ---- Datos REALES de Binance (Paso 0, 25-oct-2026): [precio, monto mínimo en Bs]
const BUY = [[11.98, 300], [11.99, 500], [11.99, 55], [12, 55], [12, 400], [12, 2370], [12, 55], [12, 3000], [12, 55], [12, 55]];
const SELL = [[11.98, 5000], [11.97, 1000], [11.96, 10000], [11.96, 6000], [11.96, 3000], [11.96, 5000], [11.96, 1000], [11.96, 3500], [11.96, 450], [11.96, 2000]];
const cuerpoBinance = (pares) => JSON.stringify({ data: pares.map(([p, min]) => ({ adv: { price: String(p), minSingleTransAmount: String(min) } })) });
const BLUE_REAL = { data: { source: 'DolarBlueBolivia', pair: 'BOB/USDT', blue: { buy: 11.96, sell: 12.01 }, official: { buy: 11.88, sell: 11.88 }, fetched_at: '2026-10-25T19:49:35.588843+00:00' } };
const silencio = { error() {} };

function fetchBinance({ buy = BUY, sell = SELL, estado = 200 } = {}) {
  const f = async (url, op) => {
    f.llamadas.push(JSON.parse(op.body));
    const lado = JSON.parse(op.body).tradeType;
    return { ok: estado === 200, status: estado, text: async () => cuerpoBinance(lado === 'BUY' ? buy : sell) };
  };
  f.llamadas = [];
  return f;
}

test('estadística y fechas', () => {
  assert.strictEqual(mediana([3, 1, 2]), 2);
  assert.strictEqual(mediana([1, 2, 3, 4]), 2.5);
  assert.throws(() => mediana([]), /vacía/);
  assert.strictEqual(fechaBolivia(new Date('2026-10-26T02:00:00Z')), '2026-10-25'); // 22:00 del 25 en La Paz
  assert.strictEqual(fechaBolivia(new Date('2026-10-26T05:00:00Z')), '2026-10-26');
});

test('Binance: con los datos reales da venta 12 y compra 11,96', async () => {
  const f = fetchBinance();
  const a = crearAdaptadorBinance({ fetchFn: f, reloj: () => Date.parse('2026-10-25T20:00:00Z') });
  verificarAdaptador(a);
  const [o] = await a.obtener();
  assert.deepStrictEqual([o.instrumento, o.entidad, o.venta, o.compra, o.valor, o.fecha], ['BOB_PARALELO', 'binance', 12, 11.96, 12, '2026-10-25']);
  assert.deepStrictEqual(f.llamadas.map((c) => c.tradeType).sort(), ['BUY', 'SELL']);
  assert.ok(f.llamadas.every((c) => c.fiat === 'BOB' && c.asset === 'USDT'));
});

test('Binance: descarta anuncios con mínimo alto y exige un mínimo de anuncios', () => {
  assert.strictEqual(precios(cuerpoBinance(SELL), 3000).length, 5);
  assert.strictEqual(precios(cuerpoBinance(BUY), 3000).length, 10);
  assert.strictEqual(precios(cuerpoBinance([[0.5, 10], [500, 10], [12, 10]]), 3000).length, 1); // precios absurdos fuera
});

test('Binance: pocos anuncios, formato raro o HTTP de error → falla', async () => {
  await assert.rejects(crearAdaptadorBinance({ fetchFn: fetchBinance({ buy: [[12, 50]] }) }).obtener(), /anuncios utilizables/);
  await assert.rejects(crearAdaptadorBinance({ fetchFn: async () => ({ ok: true, text: async () => '{"x":1}' }) }).obtener(), /formato/);
  await assert.rejects(crearAdaptadorBinance({ fetchFn: fetchBinance({ estado: 403 }) }).obtener(), /HTTP 403/);
});

test('Binance: lados incoherentes → falla', async () => {
  const caro = BUY.map(([p, m]) => [p * 2, m]);
  await assert.rejects(crearAdaptadorBinance({ fetchFn: fetchBinance({ buy: caro }) }).obtener(), /incoherentes/);
});

test('dolarbluebolivia: lee la respuesta real (compra 11,96 / venta 12,01)', () => {
  const o = convertir(BLUE_REAL);
  assert.deepStrictEqual([o.compra, o.venta, o.valor, o.fecha], [11.96, 12.01, 12.01, '2026-10-25']);
  assert.throws(() => convertir({ data: {} }), /blue/);
  assert.throws(() => convertir({ data: { blue: { buy: 'x', sell: 12 } } }), /inválido/);
});

test('respaldo: usa Binance si responde; si falla, dolarbluebolivia; si ambos fallan, error', async () => {
  const binance = crearAdaptadorBinance({ fetchFn: fetchBinance() });
  const blue = crearAdaptadorParaleloRespaldo({ cliente: { obtenerJson: async () => BLUE_REAL } });
  let r = await conRespaldo(binance, blue, { logger: silencio }).obtener();
  assert.strictEqual(r.fuente, 'binance');

  const binanceCaido = crearAdaptadorBinance({ fetchFn: fetchBinance({ estado: 451 }) });
  const registros = [];
  r = await conRespaldo(binanceCaido, blue, { logger: { error: (m) => registros.push(m) } }).obtener();
  assert.strictEqual(r.fuente, 'dolarbluebolivia');
  assert.strictEqual(r.observaciones[0].venta, 12.01);
  assert.ok(registros[0].includes('451'));

  const blueCaido = crearAdaptadorParaleloRespaldo({ cliente: { obtenerJson: async () => { throw new Error('timeout'); } } });
  await assert.rejects(conRespaldo(binanceCaido, blueCaido, { logger: silencio }).obtener(), /ambas fuentes/);
});

test('respaldo: exige que cubra los mismos instrumentos', () => {
  assert.throws(() => conRespaldo({ nombre: 'a', instrumentos: ['X'] }, { nombre: 'b', instrumentos: ['Y'] }), /no cubre X/);
});

test('caché: guarda con la fuente que realmente respondió', async () => {
  const guardado = [];
  const repo = { ultimas: async () => [], guardarVarias: async (obs, fuente) => guardado.push(fuente) };
  const adaptador = { nombre: 'binance', instrumentos: ['BOB_PARALELO'], obtener: async () => ({ fuente: 'dolarbluebolivia', observaciones: [{ instrumento: 'BOB_PARALELO' }] }) };
  const r = await crearServicioCache({ repositorio: repo, logger: silencio }).obtener({ adaptador, instrumentos: ['BOB_PARALELO'], vigenciaMin: 10 });
  assert.deepStrictEqual(guardado, ['dolarbluebolivia']);
  assert.strictEqual(r.origen, 'dolarbluebolivia');
});

test('/paralelo: forma de la respuesta', async () => {
  const fila = { instrumento: 'BOB_PARALELO', nombre: 'Dólar paralelo (Binance)', entidad: 'binance', valor: 12, compra: 11.96, venta: 12, unidad: 'Bs por USD', fecha: '2026-10-25', estado: 'vigente', obtenidoEn: new Date() };
  const res = { json(c) { this.cuerpo = c; } };
  await manejadorParalelo({ paralelo: async () => ({ origen: 'binance', desactualizado: false, observaciones: [fila] }) })({}, res, () => {});
  assert.strictEqual(res.cuerpo.cotizada, 'BOB');
  assert.deepStrictEqual([res.cuerpo.paralelo.venta, res.cuerpo.paralelo.compra], [12, 11.96]);
  assert.strictEqual(res.cuerpo.origen, 'binance');
});
