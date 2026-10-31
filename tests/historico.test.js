const test = require('node:test');
const assert = require('node:assert');
const { validarHistorico } = require('../src/routes/validacion');
const { crearServicioHistorico, sumarDias } = require('../src/services/historicoService');
const { manejadorHistorico } = require('../src/routes/historico');
const { crearRepositorioCotizaciones } = require('../src/repositories/cotizacionesRepositorio');
const { generarSeries } = require('../scripts/generarSeries');

const resFalsa = () => { const r = {}; r.json = (c) => { r.cuerpo = c; return r; }; return r; };
const HOY = Date.parse('2026-10-31T19:00:00Z'); // 15:00 en La Paz

test('validación: valores por defecto y lista blanca', () => {
  assert.deepStrictEqual(validarHistorico({}), { serie: 'ambos', dias: 30 });
  assert.deepStrictEqual(validarHistorico({ serie: 'oficial', dias: '7' }), { serie: 'oficial', dias: 7 });
  assert.deepStrictEqual(validarHistorico({ serie: 'paralelo', dias: '180' }), { serie: 'paralelo', dias: 180 });
});

test('validación: rechaza series desconocidas, días fuera de la lista y parámetros repetidos', () => {
  for (const q of [{ serie: 'euro' }, { serie: 'OFICIAL' }, { dias: '15' }, { dias: '30abc' }, { dias: '-7' }, { dias: '1e2' }, { dias: '' }, { dias: ['7', '30'] }, { serie: ['oficial', 'paralelo'] }]) {
    assert.throws(() => validarHistorico(q), (e) => e.estado === 400, JSON.stringify(q));
  }
});

test('sumarDias cruza meses y años', () => {
  assert.strictEqual(sumarDias('2026-10-31', -6), '2026-10-25');
  assert.strictEqual(sumarDias('2026-03-02', -2), '2026-02-28');
  assert.strictEqual(sumarDias('2026-01-01', -1), '2025-12-31');
});

test('servicio: rango de N días contando hoy (hora de Bolivia) y una consulta por serie', async () => {
  const pedidas = [];
  const repo = { ultimoPorDia: async (p) => { pedidas.push(p); return [{ fecha: '2026-10-30', venta: 12, compra: 11.9, valor: 12 }]; } };
  const svc = crearServicioHistorico({ repositorio: repo, reloj: () => HOY });
  const r = await svc.consultar({ serie: 'ambos', dias: 7 });
  assert.deepStrictEqual([r.desde, r.hasta, r.dias], ['2026-10-25', '2026-10-31', 7]);
  assert.deepStrictEqual(Object.keys(r.series), ['oficial', 'paralelo']);
  assert.deepStrictEqual(pedidas, [
    { instrumento: 'BOB_OFICIAL', entidad: 'bcb', desde: '2026-10-25' },
    { instrumento: 'BOB_PARALELO', entidad: 'binance', desde: '2026-10-25' },
  ]);
  pedidas.length = 0;
  await svc.consultar({ serie: 'paralelo', dias: 30 });
  assert.deepStrictEqual(pedidas.map((p) => p.instrumento), ['BOB_PARALELO']);
});

test('servicio: a las 21:00 en La Paz (01:00 UTC del día siguiente) "hoy" sigue siendo el día de Bolivia', async () => {
  const svc = crearServicioHistorico({ repositorio: { ultimoPorDia: async () => [] }, reloj: () => Date.parse('2026-11-01T01:00:00Z') });
  assert.strictEqual((await svc.consultar({ serie: 'oficial', dias: 7 })).hasta, '2026-10-31');
});

test('ruta: forma de la respuesta (venta antes que compra) y errores van a next', async () => {
  const historico = { consultar: async () => ({ dias: 7, desde: '2026-10-25', hasta: '2026-10-31', series: {
    oficial: [{ fecha: '2026-10-30', venta: 12.09, compra: null, valor: 12.09 }],
    paralelo: [{ fecha: '2026-10-30', venta: 11.97, compra: 11.92, valor: 11.97 }],
  } }) };
  const res = resFalsa();
  await manejadorHistorico(historico)({ query: { dias: '7' } }, res, () => {});
  assert.deepStrictEqual(Object.keys(res.cuerpo.series), ['oficial', 'paralelo']);
  assert.deepStrictEqual(Object.keys(res.cuerpo.series.paralelo[0]), ['fecha', 'venta', 'compra']);
  assert.deepStrictEqual(res.cuerpo.series.oficial[0], { fecha: '2026-10-30', venta: 12.09, compra: 12.09 }); // el oficial usa su valor único
  assert.strictEqual(res.cuerpo.serie, 'ambos');
  let capturado;
  await manejadorHistorico(historico)({ query: { dias: '99' } }, res, (e) => { capturado = e; });
  assert.strictEqual(capturado.estado, 400);
});

test('repositorio: consulta parametrizada, convierte NUMERIC en Number', async () => {
  const llamadas = [];
  const db = { query: async (sql, params) => { llamadas.push({ sql, params }); return { rows: [{ dia: '2026-10-30', valor: '11.970000', compra: '11.920000', venta: '11.970000' }] }; } };
  const filas = await crearRepositorioCotizaciones(db).ultimoPorDia({ instrumento: 'BOB_PARALELO', entidad: 'binance', desde: '2026-10-01' });
  assert.deepStrictEqual(filas, [{ fecha: '2026-10-30', venta: 11.97, compra: 11.92, valor: 11.97 }]);
  assert.deepStrictEqual(llamadas[0].params, ['BOB_PARALELO', 'binance', '2026-10-01']);
  assert.ok(!llamadas[0].sql.includes('BOB_PARALELO'), 'el SQL no debe contener los datos');
  assert.match(llamadas[0].sql, /estado = 'vigente'/);
});

// Réplica en memoria de la regla del SQL (último valor de cada día de Bolivia, solo vigentes), aplicada a los datos ficticios,
// para comprobar que la regla produce una serie diaria completa y coherente
test('regla "último valor del día" sobre los datos ficticios: una fila por día y es la de las 20:00', () => {
  const filas = generarSeries({ dias: 30, hoy: new Date(HOY) }).filter((f) => f.instrumento === 'BOB_PARALELO');
  const porDia = new Map();
  for (const f of [...filas].sort((a, b) => a.obtenidoEn - b.obtenidoEn)) porDia.set(new Date(f.obtenidoEn - 4 * 3_600_000).toISOString().slice(0, 10), f);
  assert.strictEqual(porDia.size, 30);
  for (const [dia, f] of porDia) assert.strictEqual(f.obtenidoEn.toISOString(), new Date(Date.parse(`${dia}T20:00:00Z`) + 4 * 3_600_000).toISOString());
});
