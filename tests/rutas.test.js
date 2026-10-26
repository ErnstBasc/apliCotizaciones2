const test = require('node:test');
const assert = require('node:assert');
const { manejadorMonedas, manejadorOficial } = require('../src/routes/fuentes');
const { presentarCotizacion } = require('../src/routes/presentadores');
const { crearServicioCotizaciones } = require('../src/services/cotizacionesService');

const resFalsa = () => { const r = {}; r.json = (c) => { r.cuerpo = c; return r; }; return r; };
const fila = (i, extra = {}) => ({ instrumento: i, nombre: i, entidad: null, valor: 1, compra: null, venta: null,
  unidad: 'por USD', fecha: '2026-10-25', estado: 'vigente', obtenidoEn: new Date('2026-10-25T12:00:00Z'), ...extra });

test('presentador: venta antes que compra y omite los nulos', () => {
  const p = presentarCotizacion(fila('BOB_OFICIAL', { entidad: 'bcb', valor: 11.88, venta: 11.88, compra: 11.88 }));
  assert.deepStrictEqual(Object.keys(p).slice(0, 5), ['codigo', 'nombre', 'entidad', 'venta', 'compra']);
  assert.ok(!('venta' in presentarCotizacion(fila('EUR'))));
  assert.ok(!('estado' in p));
});

test('/monedas: forma de la respuesta', async () => {
  const res = resFalsa();
  await manejadorMonedas({ monedas: async () => ({ origen: 'cache', desactualizado: false, observaciones: [fila('EUR')] }) })({}, res, () => {});
  assert.strictEqual(res.cuerpo.base, 'USD');
  assert.strictEqual(res.cuerpo.monedas[0].codigo, 'EUR');
});

test('/oficial: forma de la respuesta y errores van a next', async () => {
  const res = resFalsa();
  await manejadorOficial({ oficial: async () => ({ origen: 'bcb', desactualizado: false, observaciones: [fila('BOB_OFICIAL', { venta: 11.88, compra: 11.88 })] }) })({}, res, () => {});
  assert.strictEqual(res.cuerpo.cotizada, 'BOB');
  assert.strictEqual(res.cuerpo.oficial.venta, 11.88);
  let capturado;
  await manejadorOficial({ oficial: async () => { throw new Error('x'); } })({}, res, (e) => { capturado = e; });
  assert.strictEqual(capturado.message, 'x');
});

test('servicio: ordena las monedas según el adaptador y usa la vigencia configurada', async () => {
  let vigenciaUsada;
  const adaptador = { nombre: 'frankfurter', instrumentos: ['EUR', 'CLP'] };
  const cache = { obtener: async (p) => { vigenciaUsada = p.vigenciaMin; return { origen: 'cache', desactualizado: false, observaciones: [fila('CLP'), fila('EUR')] }; } };
  const svc = crearServicioCotizaciones({ cache, adaptadores: { monedas: adaptador, oficial: adaptador }, cacheMin: { monedas: 7, oficial: 60 } });
  const r = await svc.monedas();
  assert.deepStrictEqual(r.observaciones.map((o) => o.instrumento), ['EUR', 'CLP']);
  assert.strictEqual(vigenciaUsada, 7);
});
