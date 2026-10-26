const test = require('node:test');
const assert = require('node:assert');
const { crearRepositorioCotizaciones } = require('../src/repositories/cotizacionesRepositorio');

function dbFalsa(filas = []) {
  const db = { llamadas: [] };
  db.query = async (sql, params) => { db.llamadas.push({ sql, params }); return { rows: filas, rowCount: 1 }; };
  return db;
}

test('guardar usa consulta parametrizada y pasa los datos como parámetros', async () => {
  const db = dbFalsa();
  const repo = crearRepositorioCotizaciones(db);
  await repo.guardar({ instrumento: 'EUR', entidad: null, valor: 0.89, compra: null, venta: null, estado: 'vigente', fecha: '2026-10-25' }, 'frankfurter');
  const { sql, params } = db.llamadas[0];
  assert.match(sql, /\$1/);
  assert.deepStrictEqual(params, ['EUR', null, 'frankfurter', 0.89, null, null, 'vigente', '2026-10-25']);
  assert.ok(!sql.includes('EUR'), 'el SQL no debe contener los datos');
});

test('ultimas convierte NUMERIC (texto) en Number y fechas en Date', async () => {
  const db = dbFalsa([{
    instrumento: 'BOB_BANCO', nombre: 'Dólar en bancos', entidad: 'fie', unidad: 'Bs por USD', valor: null, compra: '10.980000', venta: '11.980000',
    estado: 'vigente', fecha: '2026-10-25', obtenido_en: '2026-10-25T19:29:33Z',
  }]);
  const [o] = await crearRepositorioCotizaciones(db).ultimas(['BOB_BANCO']);
  assert.strictEqual(o.compra, 10.98);
  assert.strictEqual(o.nombre, 'Dólar en bancos');
  assert.strictEqual(o.venta, 11.98);
  assert.strictEqual(o.valor, null);
  assert.ok(o.obtenidoEn instanceof Date);
  assert.deepStrictEqual(db.llamadas[0].params, [['BOB_BANCO']]);
});

test('guardarVarias guarda cada observación', async () => {
  const db = dbFalsa();
  const n = await crearRepositorioCotizaciones(db).guardarVarias(
    [{ instrumento: 'EUR', valor: 1, estado: 'vigente' }, { instrumento: 'CLP', valor: 2, estado: 'vigente' }], 'frankfurter');
  assert.strictEqual(n, 2);
  assert.strictEqual(db.llamadas.length, 2);
});
