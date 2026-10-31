const test = require('node:test');
const assert = require('node:assert');
const { generarSeries, HORAS_PARALELO } = require('../scripts/generarSeries');
const { crearObservacion } = require('../src/contracts/observacion');

const HOY = new Date('2026-10-31T19:00:00Z'); // 15:00 en La Paz

test('misma semilla → mismas series; otra semilla → distintas', () => {
  const a = generarSeries({ dias: 30, hoy: HOY, semilla: 1 });
  assert.deepStrictEqual(a, generarSeries({ dias: 30, hoy: HOY, semilla: 1 }));
  assert.notDeepStrictEqual(a, generarSeries({ dias: 30, hoy: HOY, semilla: 2 }));
});

test('cantidad de filas: 1 oficial + 6 paralelo por día; termina AYER y empieza `dias` días antes', () => {
  const filas = generarSeries({ dias: 180, hoy: HOY });
  assert.strictEqual(filas.length, 180 * (1 + HORAS_PARALELO.length));
  const fechas = [...new Set(filas.map((f) => f.fecha))].sort();
  assert.deepStrictEqual([fechas[0], fechas.at(-1), fechas.length], ['2026-05-04', '2026-10-30', 180]);
});

test('oficial: 6,96 al principio, sube por escalones y termina en 12,09 sin pasarse; compra = venta', () => {
  const of = generarSeries({ dias: 180, hoy: HOY }).filter((f) => f.instrumento === 'BOB_OFICIAL');
  assert.strictEqual(of[0].valor, 6.96);
  assert.strictEqual(of.at(-1).valor, 12.09);
  assert.ok(of.every((f) => f.valor >= 6.96 && f.valor <= 12.09 && f.venta === f.compra));
  assert.ok(of.every((f, i) => i === 0 || f.valor >= of[i - 1].valor)); // nunca baja
});

test('paralelo: venta mayor que compra, precios plausibles, tendencia de ~9,9 a ~12 y sin saltos bruscos entre días', () => {
  const pa = generarSeries({ dias: 180, hoy: HOY }).filter((f) => f.instrumento === 'BOB_PARALELO');
  assert.ok(pa.every((f) => f.venta > f.compra && f.venta > 9 && f.venta < 13));
  assert.ok(Math.abs(pa[0].venta - 9.9) < 0.3 && Math.abs(pa.at(-1).venta - 12.0) < 0.3);
  assert.ok(pa.every((f, i) => i === 0 || Math.abs(f.venta - pa[i - 1].venta) < 0.3));
});

test('las horas se guardan en UTC: 08:00 en La Paz = 12:00 UTC', () => {
  const [of] = generarSeries({ dias: 7, hoy: HOY }).filter((f) => f.instrumento === 'BOB_OFICIAL');
  assert.strictEqual(of.obtenidoEn.toISOString(), '2026-10-24T12:00:00.000Z');
});

test('cada fila cumple el contrato de Observacion y los parámetros inválidos se rechazan', () => {
  for (const f of generarSeries({ dias: 14, hoy: HOY })) {
    crearObservacion({ instrumento: f.instrumento, entidad: f.entidad, valor: f.valor, compra: f.compra, venta: f.venta, unidad: 'Bs por USD', fecha: f.fecha });
  }
  assert.throws(() => generarSeries({ dias: 3 }), /entre 7 y 730/);
  assert.throws(() => generarSeries({ dias: 'x' }), /entre 7 y 730/);
});
