const test = require('node:test');
const assert = require('node:assert');
const { crearObservacion } = require('../src/contracts/observacion');
const { verificarAdaptador } = require('../src/contracts/adaptador');

test('crea una observación válida con valores por defecto', () => {
  const o = crearObservacion({ instrumento: 'EUR', valor: 0.89145, fecha: '2026-10-26' });
  assert.strictEqual(o.entidad, null);
  assert.strictEqual(o.estado, 'vigente');
  assert.strictEqual(o.compra, null);
});

test('acepta compra y venta sin valor (banco que solo publica venta)', () => {
  const o = crearObservacion({ instrumento: 'BOB_BANCO', entidad: 'ganadero', venta: 12.18 });
  assert.strictEqual(o.venta, 12.18);
});

test('rechaza datos rotos', () => {
  assert.throws(() => crearObservacion({ valor: 1 }), /instrumento/);
  assert.throws(() => crearObservacion({ instrumento: 'X', valor: NaN }), /número/);
  assert.throws(() => crearObservacion({ instrumento: 'X', valor: '11,88' }), /número/);
  assert.throws(() => crearObservacion({ instrumento: 'X' }), /ningún valor/);
  assert.throws(() => crearObservacion({ instrumento: 'X', valor: 1, fecha: '25/10/2026' }), /fecha/);
  assert.throws(() => crearObservacion({ instrumento: 'X', valor: 1, estado: 'raro' }), /estado/);
});

test('la observación es inmutable', () => {
  const o = crearObservacion({ instrumento: 'ORO', valor: 3992.83 });
  assert.throws(() => { 'use strict'; o.valor = 1; }, TypeError);
});

test('verificarAdaptador exige nombre y obtener()', () => {
  assert.doesNotThrow(() => verificarAdaptador({ nombre: 'falso', obtener: async () => [] }));
  assert.throws(() => verificarAdaptador({ obtener: async () => [] }), /nombre/);
  assert.throws(() => verificarAdaptador({ nombre: 'x' }), /obtener/);
});
