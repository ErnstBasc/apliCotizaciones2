const test = require('node:test');
const assert = require('node:assert');
const calc = require('../src/services/calculos');
const { validarConversion } = require('../src/routes/validacion');
const { crearServicioCalculos } = require('../src/services/calculosService');
const { manejadorConvertir } = require('../src/routes/calculos');
const { ErrorValidacion } = require('../src/errores');

// Valores REALES del 25-oct-2026
const OFICIAL = { venta: 11.88, compra: 11.88 };
const PARALELO = { venta: 12, compra: 11.96 };
const MONEDAS = [
  { codigo: 'EUR', nombre: 'Euro', valor: 0.89145 },
  { codigo: 'CLP', nombre: 'Peso chileno', valor: 989.33 },
  { codigo: 'PYG', nombre: 'Guaraní paraguayo', valor: 5785 },
];

test('brecha: paralelo 12 vs oficial 11,88 → 1,01 %', () => {
  assert.strictEqual(calc.brechaPorcentaje(12, 11.88), 1.01);
});

test('resumen: 1 EUR en bolivianos y el guaraní (valor minúsculo pero no cero)', () => {
  const r = calc.construirResumen({ oficial: OFICIAL, paralelo: PARALELO, monedas: MONEDAS });
  assert.strictEqual(r.dolar_boliviano.brecha_porcentaje, 1.01);
  const eur = r.monedas.find((m) => m.codigo === 'EUR');
  assert.strictEqual(eur.en_bob.oficial.venta, calc.redondear(11.88 / 0.89145));
  assert.ok(Math.abs(eur.en_bob.oficial.venta - 13.3266) < 0.001);
  const pyg = r.monedas.find((m) => m.codigo === 'PYG');
  assert.ok(pyg.en_bob.oficial.venta > 0.002 && pyg.en_bob.oficial.venta < 0.0021);
  assert.deepStrictEqual(Object.keys(r.dolar_boliviano.oficial), ['venta', 'compra']);
});

test('conversión: pasa siempre por el dólar', () => {
  const u = calc.unidadesPorUsd({ bob: 11.88, monedas: MONEDAS });
  assert.strictEqual(calc.convertirMonto(100, 'USD', 'BOB', u), 1188);
  assert.ok(Math.abs(calc.convertirMonto(100, 'EUR', 'CLP', u) - (100 / 0.89145) * 989.33) < 1e-9);
  assert.strictEqual(calc.convertirMonto(50, 'PYG', 'PYG', u), 50);
  assert.throws(() => calc.convertirMonto(1, 'USD', 'XXX', u), /sin tasa/);
  const ida = calc.convertirMonto(100, 'EUR', 'PYG', u);
  assert.ok(Math.abs(calc.convertirMonto(ida, 'PYG', 'EUR', u) - 100) < 1e-9); // ida y vuelta
});

test('validación: acepta lo esperado y normaliza mayúsculas', () => {
  assert.deepStrictEqual(validarConversion({ monto: '100', de: 'usd', a: 'bob' }), { monto: 100, de: 'USD', a: 'BOB', tasa: 'oficial', lado: 'venta' });
  assert.strictEqual(validarConversion({ monto: '25.5', de: 'EUR', a: 'PYG', tasa: 'paralelo', lado: 'compra' }).lado, 'compra');
});

test('validación: rechaza entradas peligrosas o absurdas', () => {
  const malo = (q, patron) => assert.throws(() => validarConversion(q), (e) => e instanceof ErrorValidacion && patron.test(e.message));
  malo({}, /monto/);
  malo({ monto: '-5', de: 'USD', a: 'BOB' }, /monto/);
  malo({ monto: '1e3', de: 'USD', a: 'BOB' }, /monto/);
  malo({ monto: '10,5', de: 'USD', a: 'BOB' }, /monto/);
  malo({ monto: '1234567890123', de: 'USD', a: 'BOB' }, /monto/);
  malo({ monto: ['1', '2'], de: 'USD', a: 'BOB' }, /una sola vez/);
  malo({ monto: '1', de: 'XXX', a: 'BOB' }, /"de".*Soportadas/);
  malo({ monto: '1', de: 'USD', a: "BOB'; DROP TABLE cotizaciones;--" }, /"a"/);
  malo({ monto: '1', de: 'USD', a: 'BOB', tasa: 'wallbit' }, /tasa/);
  malo({ monto: '1', de: 'USD', a: 'BOB', lado: 'x' }, /lado/);
  malo({ monto: '1', de: '__proto__', a: 'BOB' }, /"de"/);
});

const fila = (instrumento, o) => ({ instrumento, nombre: o.nombre ?? instrumento, entidad: null, entidadNombre: null, valor: null, compra: null, venta: null, estado: 'vigente', ...o });
const COMPLETO = {
  monedas: async () => ({ desactualizado: false, observaciones: MONEDAS.map((m) => fila(m.codigo, { nombre: m.nombre, valor: m.valor })) }),
  oficial: async () => ({ desactualizado: false, observaciones: [fila('BOB_OFICIAL', { entidad: 'bcb', entidadNombre: 'Banco Central de Bolivia', valor: 11.88, venta: 11.88, compra: 11.88 })] }),
  paralelo: async () => ({ desactualizado: false, observaciones: [fila('BOB_PARALELO', { entidad: 'binance', entidadNombre: 'Binance P2P', valor: 12, venta: 12, compra: 11.96 })] }),
  billeteras: async () => ({ desactualizado: false, observaciones: [fila('BOB_BILLETERA', { entidad: 'wallbit', entidadNombre: 'Wallbit', valor: 12.17, venta: 12.17, compra: 11.82 })] }),
  bancos: async () => ({ desactualizado: false, observaciones: [
    fila('BOB_BANCO', { entidad: 'fie', entidadNombre: 'Banco FIE', venta: 11.98, compra: 10.98 }),
    fila('BOB_BANCO', { entidad: 'fortaleza', entidadNombre: 'Banco Fortaleza', venta: 12.18, compra: 11.58 }),
    fila('BOB_BANCO', { entidad: 'ganadero', entidadNombre: 'Banco Ganadero', venta: 12.18, compra: null }),
    fila('BOB_BANCO', { entidad: 'prodem', entidadNombre: 'Banco Prodem', venta: 11.85, compra: 11.45, estado: 'desactualizado' }),
  ] }),
};

test('servicio: resumen y conversión con las fuentes', async () => {
  const s = crearServicioCalculos({ cotizaciones: COMPLETO });
  const r = await s.resumen();
  assert.strictEqual(r.base, 'USD');
  assert.strictEqual(r.dolar_boliviano.paralelo.venta, 12);
  const c = await s.convertir({ monto: 100, de: 'USD', a: 'BOB', tasa: 'paralelo', lado: 'compra' });
  assert.strictEqual(c.resultado, 1196);
});

test('servicio: convertir sin boliviano NO consulta oficial ni paralelo', async () => {
  const llamadas = [];
  const espia = { ...COMPLETO, oficial: async () => { llamadas.push('oficial'); return COMPLETO.oficial(); }, paralelo: async () => { llamadas.push('paralelo'); return COMPLETO.paralelo(); } };
  const c = await crearServicioCalculos({ cotizaciones: espia }).convertir({ monto: 10, de: 'EUR', a: 'CLP', tasa: 'oficial', lado: 'venta' });
  assert.deepStrictEqual(llamadas, []);
  assert.ok(c.resultado > 0);
});

test('comparación: mejor comprar FIE (11,98), mejor vender Binance (11,96); el oficial no compite; Prodem excluido', async () => {
  const r = await crearServicioCalculos({ cotizaciones: COMPLETO }).comparacion();
  assert.strictEqual(r.mejor_para_comprar.entidad, 'fie');
  assert.strictEqual(r.mejor_para_vender.entidad, 'binance');
  assert.strictEqual(r.excluidas_por_desactualizadas, 1);
  assert.ok(!r.comprar_dolares.some((f) => f.entidad === 'prodem'));
  assert.ok(r.vender_dolares.some((f) => f.entidad === 'bcb' && f.tipo === 'referencia')); // aparece, pero no es "mejor"
  assert.ok(!r.vender_dolares.some((f) => f.entidad === 'ganadero')); // sin compra
  assert.strictEqual(r.comprar_dolares[0].entidad, 'bcb'); // la referencia (11,88) encabeza la lista pero no es "mejor"
  assert.strictEqual(r.comprar_dolares.find((f) => f.entidad === 'fie').diferencia_vs_oficial_pct, 0.84); // 11,98 vs 11,88
  assert.deepStrictEqual(r.fuentes_con_error, []);
  assert.deepStrictEqual(r.comprar_dolares.map((f) => f.precio), [...r.comprar_dolares.map((f) => f.precio)].sort((a, b) => a - b));
});

test('comparación: tolera una fuente caída y falla solo si caen todas', async () => {
  const caida = async () => { throw new Error('x'); };
  const r = await crearServicioCalculos({ cotizaciones: { ...COMPLETO, bancos: caida } }).comparacion();
  assert.deepStrictEqual(r.fuentes_con_error, ['bancos']);
  assert.strictEqual(r.mejor_para_comprar.entidad, 'binance');
  await assert.rejects(crearServicioCalculos({ cotizaciones: { oficial: caida, paralelo: caida, billeteras: caida, bancos: caida } }).comparacion(), /fuente/);
});

test('/convertir: entrada inválida → ErrorValidacion por next(); válida → JSON', async () => {
  const servicio = crearServicioCalculos({ cotizaciones: COMPLETO });
  let error;
  await manejadorConvertir(servicio)({ query: { monto: 'abc', de: 'USD', a: 'BOB' } }, {}, (e) => { error = e; });
  assert.strictEqual(error.estado, 400);
  const res = { json(c) { this.cuerpo = c; } };
  await manejadorConvertir(servicio)({ query: { monto: '100', de: 'USD', a: 'BOB' } }, res, () => {});
  assert.strictEqual(res.cuerpo.resultado, 1188);
});
