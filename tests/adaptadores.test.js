const test = require('node:test');
const assert = require('node:assert');
const { crearAdaptadorFrankfurter, convertir } = require('../src/adapters/frankfurter');
const { extraerOficial, crearAdaptadorBcbOficial } = require('../src/adapters/bcb/oficial');
const { htmlATexto } = require('../src/adapters/bcb/portada');
const { verificarAdaptador } = require('../src/contracts/adaptador');

// ---- Datos REALES capturados el 25-oct-2026 (Paso 0)
const FRANKFURTER_REAL = JSON.stringify([
  { date: '2026-10-25', base: 'USD', quote: 'ARS', rate: 1528.8 },
  { date: '2026-10-25', base: 'USD', quote: 'BOB', rate: 11.8147 },
  { date: '2026-10-25', base: 'USD', quote: 'BRL', rate: 5.0364 },
  { date: '2026-10-25', base: 'USD', quote: 'CLP', rate: 989.33 },
  { date: '2026-10-26', base: 'USD', quote: 'EUR', rate: 0.89145 },
  { date: '2026-10-25', base: 'USD', quote: 'PEN', rate: 3.4461 },
  { date: '2026-10-25', base: 'USD', quote: 'PYG', rate: 5785 },
]);
const BCB_REAL = 'Tipo de cambio oficial Bolivianos por dólar estadounidense VIGENTE PARA EL SÁBADO 24, DOMINGO 25 Y LUNES 26 DE OCTUBRE, 2026 Bs --> 11,88 Más información Microd';
const respuesta = (cuerpo, ok = true, status = 200) => ({ ok, status, text: async () => cuerpo });

test('Frankfurter: convierte la respuesta real, incluye PYG e ignora BOB', () => {
  const obs = convertir(FRANKFURTER_REAL);
  assert.deepStrictEqual(obs.map((o) => o.instrumento).sort(), ['ARS', 'BRL', 'CLP', 'EUR', 'PEN', 'PYG']);
  const pyg = obs.find((o) => o.instrumento === 'PYG');
  assert.strictEqual(pyg.valor, 5785);
  assert.strictEqual(pyg.unidad, 'por USD');
  assert.strictEqual(obs.find((o) => o.instrumento === 'EUR').fecha, '2026-10-26'); // se respeta la fecha de la fuente
});

test('Frankfurter: si falta una moneda devuelve las demás; si no hay ninguna, falla', () => {
  assert.strictEqual(convertir(JSON.stringify([{ date: '2026-10-25', quote: 'EUR', rate: 0.9 }])).length, 1);
  assert.throws(() => convertir('[]'), /ninguna/);
  assert.throws(() => convertir('{"error":"x"}'), /arreglo/);
  assert.throws(() => convertir(JSON.stringify([{ date: '2026-10-25', quote: 'EUR', rate: 0 }])), /inválida/);
});

test('Frankfurter: pide la URL correcta y respeta el contrato de adaptador', async () => {
  let urlPedida;
  const a = crearAdaptadorFrankfurter({ fetchFn: async (u) => { urlPedida = u; return respuesta(FRANKFURTER_REAL); } });
  verificarAdaptador(a);
  const obs = await a.obtener();
  assert.match(urlPedida, /v2\/rates\?base=USD&quotes=EUR,CLP,ARS,PEN,BRL,PYG$/);
  assert.strictEqual(obs.length, 6);
});

test('Frankfurter: HTTP de error → falla con mensaje claro', async () => {
  const a = crearAdaptadorFrankfurter({ fetchFn: async () => respuesta('', false, 503) });
  await assert.rejects(a.obtener(), /HTTP 503/);
});

test('BCB: lee el texto real (oficial 11,88, vigente hasta el 26-oct)', () => {
  assert.deepStrictEqual(extraerOficial(BCB_REAL), { valor: 11.88, fecha: '2026-10-26' });
});

test('BCB: funciona a través de HTML y encuentra el bloque correcto aunque haya un menú antes', () => {
  const html = `<nav><a>Tipo de cambio oficial</a></nav><script>var x=1,23;</script><div><h3>Tipo de cambio oficial</h3>
    <p>VIGENTE PARA EL SÁBADO 24, DOMINGO 25 Y LUNES 26 DE OCTUBRE, 2026</p><b>Bs --&gt; 11,88</b></div>`;
  assert.strictEqual(extraerOficial(htmlATexto(html)).valor, 11.88);
});

test('BCB: valores absurdos o formato cambiado → falla (no guarda basura)', () => {
  assert.throws(() => extraerOficial('Tipo de cambio oficial Bs 0,50'), /formato/);
  assert.throws(() => extraerOficial('Tipo de cambio oficial Bs 99,00'), /formato/);
  assert.throws(() => extraerOficial('Página en mantenimiento'), /formato/);
});

test('BCB: el adaptador entrega una Observacion con venta = compra = valor', async () => {
  const a = crearAdaptadorBcbOficial({ obtenerTexto: async () => BCB_REAL });
  verificarAdaptador(a);
  const [o] = await a.obtener();
  assert.strictEqual(a.nombre, 'bcb');
  assert.deepStrictEqual([o.instrumento, o.entidad, o.valor, o.compra, o.venta, o.fecha], ['BOB_OFICIAL', 'bcb', 11.88, 11.88, 11.88, '2026-10-26']);
});
