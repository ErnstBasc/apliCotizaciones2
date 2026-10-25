const test = require('node:test');
const assert = require('node:assert');
const { cargarConfig, minutosDesdeEnv, listaDesdeEnv } = require('../src/config');

test('valores por defecto con entorno vacío', () => {
  const c = cargarConfig({});
  assert.strictEqual(c.puerto, 3000);
  assert.strictEqual(c.cacheMin.oficial, 60);
  assert.strictEqual(c.cacheMin.paralelo, 10);
  assert.deepStrictEqual(c.corsOrigenes, []);
});

test('minutos: 0 y decimales válidos; basura cae al valor por defecto', () => {
  assert.strictEqual(minutosDesdeEnv({ X: '0' }, 'X', 10), 0);
  assert.strictEqual(minutosDesdeEnv({ X: '0.5' }, 'X', 10), 0.5);
  assert.strictEqual(minutosDesdeEnv({ X: 'abc' }, 'X', 10), 10);
  assert.strictEqual(minutosDesdeEnv({ X: '-3' }, 'X', 10), 10);
  assert.strictEqual(minutosDesdeEnv({}, 'X', 10), 10);
});

test('lista de orígenes CORS', () => {
  assert.deepStrictEqual(listaDesdeEnv({ C: 'http://a.com, http://b.com ,' }, 'C'), ['http://a.com', 'http://b.com']);
  assert.deepStrictEqual(cargarConfig({ CORS_ORIGINS: 'http://localhost:5173' }).corsOrigenes, ['http://localhost:5173']);
});

test('lee puerto y base desde el entorno', () => {
  const c = cargarConfig({ PORT: '4000', DB_NAME: 'otra' });
  assert.strictEqual(c.puerto, 4000);
  assert.strictEqual(c.db.database, 'otra');
});
