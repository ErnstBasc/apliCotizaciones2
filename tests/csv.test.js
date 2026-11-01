const test = require('node:test');
const assert = require('node:assert');
const { aCsv } = require('../src/utilidades/csv');
const { manejadorHistoricoCsv, filasCsv, crearRutasHistorico } = require('../src/routes/historico');
const { validarExportacion } = require('../src/routes/validacion');

test('csv estándar: coma, punto decimal, CRLF, sin BOM, celdas vacías', () => {
  assert.strictEqual(aCsv(['fecha', 'a'], [['2026-10-30', 12.09], ['2026-10-31', null]]), 'fecha,a\r\n2026-10-30,12.09\r\n2026-10-31,\r\n');
});

test('csv excel: punto y coma, coma decimal y BOM', () => {
  assert.strictEqual(aCsv(['fecha', 'a'], [['2026-10-30', 12.09]], 'excel'), '﻿fecha;a\r\n2026-10-30;12,09\r\n');
});

test('csv: entrecomilla separadores, comillas y saltos de línea; formato desconocido falla', () => {
  assert.strictEqual(aCsv(['x'], [['a,b'], ['di "hola"'], ['l1\nl2']]), 'x\r\n"a,b"\r\n"di ""hola"""\r\n"l1\nl2"\r\n');
  assert.throws(() => aCsv(['x'], [], 'raro'), /desconocido/);
});

const pt = (fecha, venta, compra) => ({ fecha, venta, compra, valor: venta });
const SERIES = {
  oficial: [pt('2026-10-29', 12.09, 12.09), pt('2026-10-30', 12.09, 12.09)],
  paralelo: [pt('2026-10-30', 11.97, 11.92), pt('2026-10-31', 12.01, 11.95)],
};

test('filas: unión de fechas ordenadas, venta antes que compra, huecos vacíos', () => {
  const { encabezados, filas } = filasCsv(SERIES);
  assert.deepStrictEqual(encabezados, ['fecha', 'oficial_bs_por_usd', 'paralelo_venta_bs_por_usd', 'paralelo_compra_bs_por_usd']);
  assert.deepStrictEqual(filas, [
    ['2026-10-29', 12.09, null, null],
    ['2026-10-30', 12.09, 11.97, 11.92],
    ['2026-10-31', null, 12.01, 11.95],
  ]);
  assert.deepStrictEqual(filasCsv({ oficial: SERIES.oficial }).encabezados, ['fecha', 'oficial_bs_por_usd']);
});

function resFalsa() {
  const r = { cab: {} };
  r.setHeader = (k, v) => { r.cab[k] = v; };
  r.send = (c) => { r.cuerpo = c; };
  return r;
}
const historico = { consultar: async ({ serie, dias }) => ({ dias, desde: '2026-10-02', hasta: '2026-10-31', series: serie === 'oficial' ? { oficial: SERIES.oficial } : SERIES }) };

test('descarga: cabeceras de archivo, sin caché, formato por defecto excel', async () => {
  const res = resFalsa();
  await manejadorHistoricoCsv(historico)({ query: { serie: 'oficial', dias: '30' } }, res, (e) => { throw e; });
  assert.match(res.cab['Content-Type'], /^text\/csv; charset=utf-8/);
  assert.strictEqual(res.cab['Content-Disposition'], 'attachment; filename="dolar-bolivia_oficial_2026-10-02_2026-10-31.csv"');
  assert.strictEqual(res.cab['Cache-Control'], 'private, no-store');
  assert.ok(res.cuerpo.startsWith('﻿fecha;oficial_bs_por_usd'));
  assert.ok(res.cuerpo.includes('12,09'));
});

test('descarga: parámetros inválidos van a next como 400; formato estándar', async () => {
  const res = resFalsa();
  let err;
  await manejadorHistoricoCsv(historico)({ query: { dias: '5' } }, res, (e) => { err = e; });
  assert.strictEqual(err.estado, 400);
  await manejadorHistoricoCsv(historico)({ query: { formato: 'xml' } }, res, (e) => { err = e; });
  assert.match(err.message, /formato/);
  await manejadorHistoricoCsv(historico)({ query: { formato: 'estandar' } }, res, () => {});
  assert.ok(res.cuerpo.startsWith('fecha,oficial'));
  assert.deepStrictEqual(validarExportacion({}), { serie: 'ambos', dias: 30, formato: 'excel' });
});

test('ruta: con guardias se monta /historico.csv con las guardias delante; sin guardias NO existe (falla cerrado)', () => {
  const montar = (guardias) => {
    const rutas = {};
    const router = { get: (p, ...fns) => { rutas[p] = fns; } };
    crearRutasHistorico({ Router: () => router }, historico, guardias);
    return rutas;
  };
  const g1 = () => {}; const g2 = () => {};
  const con = montar([g1, g2]);
  assert.strictEqual(con['/historico.csv'][0], g1);
  assert.strictEqual(con['/historico.csv'][1], g2);
  assert.strictEqual(con['/historico.csv'].length, 3);
  assert.deepStrictEqual(Object.keys(montar(undefined)), ['/historico']);
});
