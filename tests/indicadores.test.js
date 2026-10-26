const test = require('node:test');
const assert = require('node:assert');
const { extraerOro } = require('../src/adapters/bcb/oro');
const { extraerUfv } = require('../src/adapters/bcb/ufv');
const { extraerInflacion } = require('../src/adapters/bcb/inflacion');
const { finDeMes, numeroBoliviano, fechaEncabezado } = require('../src/adapters/bcb/utilidades');
const { crearAdaptadorBcbIndicadores } = require('../src/adapters/bcb/indicadores');
const { verificarAdaptador } = require('../src/contracts/adaptador');
const { manejadorIndicadores } = require('../src/routes/fuentes');

// Texto armado con fragmentos REALES de la portada (salida del Paso 0, 25-oct-2026).
// La fecha del encabezado del oro ("26 de octubre, 2026") es una SUPOSICIÓN: en la salida real se cortó.
const MENU = 'Informe de Operaciones del Oro Reservas Internacionales del BCB Normativa de Administración de Reservas Internacionales y Compra de Oro Deuda Externa';
const BLOQUE = 'lunes 26 de octubre, 2026 Oro USD./O.T.F. 3.992,83 Más información UFV Bs/UFV 3,36331 Más información Base monetaria en moneda nacional y UFV jueves 22 de octubre, 2026 124.403 Saldo en millones de bolivianos';
const INFL = 'Indicadores de inflación En porcentaje septiembre de 2026 IPC (2016 = 100) 152,85 Mensual 0,85 12 meses 5,70 Más información CALENDARIO ANTICIPADO';
const PORTADA = `${MENU} ... ${BLOQUE} ... ${INFL}`;
const silencio = { error() {} };

test('utilidades: números bolivianos, fin de mes y fecha de encabezado', () => {
  assert.strictEqual(numeroBoliviano('3.992,83'), 3992.83);
  assert.strictEqual(numeroBoliviano('-0,15'), -0.15);
  assert.strictEqual(finDeMes('septiembre', 2026), '2026-09-30');
  assert.strictEqual(finDeMes('febrero', 2028), '2028-02-29');
  assert.strictEqual(finDeMes('inventado', 2026), null);
  assert.strictEqual(fechaEncabezado('xx 6 de octubre, 2026 ', 22), '2026-10-06');
});

test('oro: ignora el menú y lee el valor real', () => {
  assert.deepStrictEqual(extraerOro(PORTADA), { valor: 3992.83, fecha: '2026-10-26' });
  assert.throws(() => extraerOro(MENU), /oro/);
  assert.throws(() => extraerOro('Oro USD./O.T.F. 12,00'), /rango/);
});

test('UFV: ignora la otra mención y lee 3,36331', () => {
  assert.deepStrictEqual(extraerUfv(PORTADA), { valor: 3.36331, fecha: '2026-10-26' });
  assert.throws(() => extraerUfv('Base monetaria en moneda nacional y UFV'), /UFV/);
  assert.throws(() => extraerUfv('UFV Bs/UFV 99,00000'), /rango/);
});

test('UFV y oro sin fecha de encabezado: fecha null (no inventa)', () => {
  assert.strictEqual(extraerUfv('Oro USD./O.T.F. 3.992,83 UFV Bs/UFV 3,36331').fecha, null);
});

test('inflación: septiembre 2026 → mensual 0,85; 12 meses 5,70; fecha fin de mes', () => {
  assert.deepStrictEqual(extraerInflacion(PORTADA), { mensual: 0.85, doceMeses: 5.7, fecha: '2026-09-30' });
  assert.deepStrictEqual(extraerInflacion(INFL.replace('0,85', '-0,15')).mensual, -0.15);
  assert.throws(() => extraerInflacion(INFL.replace('septiembre', 'sextiembre')), /mes desconocido/);
  assert.throws(() => extraerInflacion(INFL.replace('0,85', '85,00')), /rango/);
  assert.throws(() => extraerInflacion('nada'), /inflación/);
});

test('adaptador: entrega 4 observaciones con la unidad correcta', async () => {
  const a = crearAdaptadorBcbIndicadores({ obtenerTexto: async () => PORTADA, logger: silencio });
  verificarAdaptador(a);
  const obs = await a.obtener();
  const por = Object.fromEntries(obs.map((o) => [o.instrumento, o]));
  assert.deepStrictEqual(Object.keys(por).sort(), ['INFLACION_12M', 'INFLACION_MENSUAL', 'ORO', 'UFV']);
  assert.strictEqual(por.ORO.unidad, 'USD por onza troy');
  assert.strictEqual(por.UFV.valor, 3.36331);
  assert.strictEqual(por.INFLACION_12M.valor, 5.7);
});

test('adaptador: si un indicador cambia de formato, guarda los demás y lo registra', async () => {
  const registros = [];
  const sinOro = PORTADA.replace('Oro USD./O.T.F.', 'Oro nuevo formato');
  const a = crearAdaptadorBcbIndicadores({ obtenerTexto: async () => sinOro, logger: { error: (m) => registros.push(m) } });
  const obs = await a.obtener();
  assert.ok(!obs.some((o) => o.instrumento === 'ORO'));
  assert.strictEqual(obs.length, 3);
  assert.ok(registros.some((m) => m.includes('bcb/oro')));
});

test('adaptador: si no se lee ninguno, falla', async () => {
  const a = crearAdaptadorBcbIndicadores({ obtenerTexto: async () => 'sitio en mantenimiento', logger: silencio });
  await assert.rejects(a.obtener(), /ningún indicador/);
});

test('/indicadores: forma de la respuesta', async () => {
  const f = (i, v, u) => ({ instrumento: i, nombre: i, entidad: 'bcb', valor: v, compra: null, venta: null, unidad: u, fecha: '2026-10-26', estado: 'vigente', obtenidoEn: new Date() });
  const servicio = { indicadores: async () => ({ origen: 'bcb', desactualizado: false, observaciones: [f('ORO', 3992.83, 'USD por onza troy'), f('UFV', 3.36331, 'Bs por UFV'), f('INFLACION_MENSUAL', 0.85, '%'), f('INFLACION_12M', 5.7, '%')] }) };
  const res = { json(c) { this.cuerpo = c; } };
  await manejadorIndicadores(servicio)({}, res, () => {});
  assert.strictEqual(res.cuerpo.oro.valor, 3992.83);
  assert.strictEqual(res.cuerpo.inflacion.doce_meses.valor, 5.7);
});
