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

test('auth: sin JWT_SECRET en desarrollo no falla (server.js genera uno); en producción sí; un secreto corto siempre falla', () => {
  assert.strictEqual(cargarConfig({}).auth.secreto, undefined);
  assert.throws(() => cargarConfig({ NODE_ENV: 'production' }), /JWT_SECRET/);
  assert.throws(() => cargarConfig({ JWT_SECRET: 'corto' }), /32 caracteres/);
  const c = cargarConfig({ NODE_ENV: 'production', JWT_SECRET: 'k'.repeat(32), APP_URL: 'https://cotiza.example/' });
  assert.strictEqual(c.auth.cookieSegura, true);
  assert.strictEqual(c.auth.urlPublica, 'https://cotiza.example');
  assert.strictEqual(cargarConfig({ PORT: '4000' }).auth.urlPublica, 'http://localhost:4000');
  assert.strictEqual(cargarConfig({}).auth.cookieSegura, false);
  assert.strictEqual(cargarConfig({}).auth.duracionDias, 7);
  assert.strictEqual(cargarConfig({}).correo.modo, 'consola');
});
