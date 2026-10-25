const test = require('node:test');
const assert = require('node:assert');
const { manejarErrores } = require('../src/middleware/errores');
const { ErrorValidacion, ErrorFuente } = require('../src/errores');
const { manejadorHealth } = require('../src/routes/health');

function resFalsa() {
  const r = { headersSent: false };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (c) => { r.cuerpo = c; return r; };
  return r;
}
const registros = [];
const logger = { error: (...a) => registros.push(a.join(' ')) };

test('error esperado: usa su estado y su mensaje público', () => {
  const res = resFalsa();
  manejarErrores(logger)(new ErrorValidacion('moneda inválida'), {}, res, () => {});
  assert.strictEqual(res.codigo, 400);
  assert.strictEqual(res.cuerpo.mensaje, 'moneda inválida');
});

test('ErrorFuente: el detalle interno se registra pero NO se envía', () => {
  const res = resFalsa();
  manejarErrores(logger)(new ErrorFuente('bcb', 'ECONNRESET 10.0.0.5'), {}, res, () => {});
  assert.strictEqual(res.codigo, 502);
  assert.ok(!JSON.stringify(res.cuerpo).includes('ECONNRESET'));
  assert.ok(registros.some((l) => l.includes('ECONNRESET')));
});

test('error inesperado: 500 genérico, sin filtrar el mensaje', () => {
  const res = resFalsa();
  manejarErrores(logger)(new Error('password authentication failed for user "postgres"'), {}, res, () => {});
  assert.strictEqual(res.codigo, 500);
  assert.ok(!JSON.stringify(res.cuerpo).includes('password'));
});

test('JSON mal formado: 400', () => {
  const res = resFalsa();
  manejarErrores(logger)({ type: 'entity.parse.failed' }, {}, res, () => {});
  assert.strictEqual(res.codigo, 400);
});

test('health: ok con base conectada', async () => {
  const res = resFalsa();
  await manejadorHealth({ contarInstrumentos: async () => 14 })({}, res, () => {});
  assert.deepStrictEqual(res.cuerpo, { estado: 'ok', base_de_datos: 'conectada', instrumentos: 14 });
});

test('health: base caída → error 503 genérico (pasa por next)', async () => {
  let recibido;
  await manejadorHealth({ contarInstrumentos: async () => { throw new Error('ECONNREFUSED'); } })({}, resFalsa(), (e) => { recibido = e; });
  assert.strictEqual(recibido.estado, 503);
  assert.ok(!recibido.message.includes('ECONNREFUSED'));
});
