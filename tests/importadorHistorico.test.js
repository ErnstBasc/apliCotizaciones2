const test = require('node:test');
const assert = require('node:assert');
const { extraerPuntos, instanteDe, convertir, ultimoPorDia, planificar } = require('../src/services/importadorHistorico');

const AHORA = new Date('2026-11-22T22:00:00Z'); // 18:00 del 22 en La Paz
const seg = (iso) => Date.parse(iso) / 1000;

test('extraerPuntos acepta la lista sola o envuelta en data / points', () => {
  const p = [{ a: 1 }];
  assert.strictEqual(extraerPuntos(p), p);
  assert.strictEqual(extraerPuntos({ data: p }), p);
  assert.strictEqual(extraerPuntos({ data: { points: p } }), p);
  assert.throws(() => extraerPuntos({ data: {} }), /--explorar/);
});

test('instanteDe: t en segundos o milisegundos, o una fecha sola (mediodía de Bolivia)', () => {
  assert.strictEqual(instanteDe({ t: seg('2026-11-20T15:00:00Z') }).toISOString(), '2026-11-20T15:00:00.000Z');
  assert.strictEqual(instanteDe({ t: Date.parse('2026-11-20T15:00:00Z') }).toISOString(), '2026-11-20T15:00:00.000Z');
  assert.strictEqual(instanteDe({ d: '2026-11-20' }).toISOString(), '2026-11-20T16:00:00.000Z');
  assert.strictEqual(instanteDe({ x: 1 }), null);
});

test('convertir paralelo: bs = venta, bb = compra; descarta puntos sin fecha o con valores absurdos', () => {
  const json = { data: [
    { t: seg('2026-11-20T14:00:00Z'), bb: 11.9, bs: 12.0, ob: 9.5, os: 9.6 },
    { t: seg('2026-11-20T15:00:00Z'), bb: '11.95', bs: '12.05' }, // números como texto
    { t: seg('2026-11-20T16:00:00Z'), bb: 0, bs: 0 },               // absurdo
    { bb: 11, bs: 12 },                                              // sin fecha
  ] };
  const { lecturas, descartados } = convertir('paralelo', json);
  assert.strictEqual(descartados, 2);
  assert.deepStrictEqual(lecturas.map((l) => [l.venta, l.compra]), [[12.0, 11.9], [12.05, 11.95]]);
});

test('convertir oficial: sell = venta, buy = compra; sin compra válida usa la venta', () => {
  const { lecturas } = convertir('oficial', [{ d: '2026-11-19', buy: 9.5, sell: 9.6, kind: 'x' }, { d: '2026-11-20', sell: 9.7 }]);
  assert.deepStrictEqual(lecturas.map((l) => [l.dia, l.venta, l.compra]), [['2026-11-19', 9.6, 9.5], ['2026-11-20', 9.7, 9.7]]);
});

test('ultimoPorDia: queda la última lectura de cada día de Bolivia (el día cambia a las 04:00 UTC)', () => {
  const { lecturas } = convertir('paralelo', [
    { t: seg('2026-11-20T03:30:00Z'), bb: 11.0, bs: 11.1 }, // 23:30 del 19 en La Paz
    { t: seg('2026-11-20T12:00:00Z'), bb: 11.2, bs: 11.3 },
    { t: seg('2026-11-20T23:00:00Z'), bb: 11.4, bs: 11.5 }, // 19:00 del 20
  ]);
  assert.deepStrictEqual(ultimoPorDia(lecturas).map((l) => [l.dia, l.venta]), [['2026-11-19', 11.1], ['2026-11-20', 11.5]]);
});

test('planificar: un valor por día, sin hoy y sin pisar los días que ya tienen datos', () => {
  const { lecturas } = convertir('paralelo', [
    { t: seg('2026-11-19T20:00:00Z'), bb: 11.0, bs: 11.1 },
    { t: seg('2026-11-20T20:00:00Z'), bb: 11.2, bs: 11.3 },
    { t: seg('2026-11-21T20:00:00Z'), bb: 11.4, bs: 11.5 },
    { t: seg('2026-11-22T20:00:00Z'), bb: 11.6, bs: 11.7 }, // hoy
  ]);
  const plan = planificar({ serie: 'paralelo', lecturas, diasOcupados: ['2026-11-20'], ahora: AHORA });
  assert.deepStrictEqual(plan.filas.map((f) => f.fecha), ['2026-11-19', '2026-11-21']);
  assert.deepStrictEqual(plan.filas[0], {
    instrumento: 'BOB_PARALELO', entidad: 'binance', valor: 11.1, venta: 11.1, compra: 11.0,
    fecha: '2026-11-19', obtenidoEn: new Date('2026-11-19T20:00:00Z'),
  });
  assert.strictEqual(plan.yaExistian, 1);
  assert.deepStrictEqual([plan.desde, plan.hasta], ['2026-11-19', '2026-11-21']);
});

test('planificar: repetir la importación no agrega nada (idempotente)', () => {
  const { lecturas } = convertir('oficial', [{ d: '2026-11-19', sell: 9.6 }, { d: '2026-11-20', sell: 9.7 }]);
  const primera = planificar({ serie: 'oficial', lecturas, diasOcupados: [], ahora: AHORA });
  assert.strictEqual(primera.filas.length, 2);
  assert.strictEqual(primera.filas[0].entidad, 'bcb');
  const segunda = planificar({ serie: 'oficial', lecturas, diasOcupados: primera.filas.map((f) => f.fecha), ahora: AHORA });
  assert.strictEqual(segunda.filas.length, 0);
});
