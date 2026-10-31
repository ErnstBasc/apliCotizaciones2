const test = require('node:test');
const assert = require('node:assert');
const { crearRecolector, crearTareas } = require('../src/services/recolector');
const { cargarConfig } = require('../src/config');

const silencio = { log() {}, error() {} };
const pausa = () => new Promise((r) => setImmediate(r));

// Temporizador manual: nada corre hasta que la prueba lo dispara (no se espera tiempo real)
function temporizadorFalso() {
  const pendientes = [];
  return {
    pendientes,
    setTimeoutFn: (fn, ms) => { const t = { fn, ms }; pendientes.push(t); return t; },
    clearTimeoutFn: (t) => { const i = pendientes.indexOf(t); if (i >= 0) pendientes.splice(i, 1); },
    async disparar(indice = 0) { const [t] = pendientes.splice(indice, 1); t.fn(); await pausa(); await pausa(); },
  };
}

test('configuración: intervalos por defecto del recolector y 0 para desactivar', () => {
  const c = cargarConfig({});
  assert.deepStrictEqual(c.recolectorMin, { paralelo: 15, billeteras: 15, bancos: 60, oficial: 60, indicadores: 360, monedas: 360 });
  assert.strictEqual(cargarConfig({ RECOLECTOR_BANCOS_MIN: '0' }).recolectorMin.bancos, 0);
});

test('crearTareas: omite las desactivadas y trata datos viejos como fallo', async () => {
  const llamadas = [];
  const cotizaciones = {
    paralelo: async () => { llamadas.push('paralelo'); return { origen: 'binance', desactualizado: false, observaciones: [1] }; },
    bancos: async () => ({ origen: 'cache', desactualizado: true, observaciones: [1, 2] }),
  };
  const tareas = crearTareas({ cotizaciones, cadaMin: { paralelo: 15, bancos: 60, billeteras: 0, oficial: 0, indicadores: 0, monedas: 0 } });
  assert.deepStrictEqual(tareas.map((t) => [t.nombre, t.cadaMin]), [['paralelo', 15], ['bancos', 60]]);
  assert.strictEqual(await tareas[0].ejecutar(), 'origen binance, 1 dato(s)');
  await assert.rejects(tareas[1].ejecutar(), /se conservan los datos anteriores/);
});

test('las primeras ejecuciones se escalonan y luego se repiten cada intervalo', async () => {
  const t = temporizadorFalso();
  const corridas = [];
  const tareas = [
    { nombre: 'a', cadaMin: 15, ejecutar: async () => { corridas.push('a'); return 'ok'; } },
    { nombre: 'b', cadaMin: 60, ejecutar: async () => { corridas.push('b'); return 'ok'; } },
  ];
  const r = crearRecolector({ tareas, logger: silencio, escalonadoMs: 3000, ...t });
  r.iniciar();
  assert.deepStrictEqual(t.pendientes.map((p) => p.ms), [0, 3000]);
  await t.disparar(0);
  await t.disparar(0);
  assert.deepStrictEqual(corridas, ['a', 'b']);
  assert.deepStrictEqual(t.pendientes.map((p) => p.ms).sort((x, y) => x - y), [15 * 60_000, 60 * 60_000]);
  await t.disparar(0); // vuelve a correr la de 15 min
  assert.deepStrictEqual(corridas, ['a', 'b', 'a']);
  assert.strictEqual(r.estado().find((e) => e.nombre === 'a').ejecuciones, 2);
  await r.detener();
});

test('un fallo se registra, cuenta, y no impide la siguiente ejecución ni las otras tareas', async () => {
  const t = temporizadorFalso();
  const errores = [];
  let intento = 0;
  const tareas = [
    { nombre: 'rota', cadaMin: 1, ejecutar: async () => { intento += 1; if (intento === 1) throw new Error('HTTP 500'); return 'ok'; } },
    { nombre: 'sana', cadaMin: 1, ejecutar: async () => 'ok' },
  ];
  const r = crearRecolector({ tareas, logger: { log() {}, error: (m) => errores.push(m) }, ...t });
  r.iniciar();
  await t.disparar(0);
  await t.disparar(0);
  let e = r.estado();
  assert.deepStrictEqual([e[0].fallos, e[0].ultimoError, e[1].fallos], [1, 'HTTP 500', 0]);
  assert.match(errores[0], /rota: falló \(HTTP 500\)/);
  await t.disparar(0); // la tarea rota se reprograma y esta vez funciona
  e = r.estado();
  assert.deepStrictEqual([e[0].ejecuciones, e[0].ultimoError !== null], [2, false]);
  await r.detener();
});

test('no hay solapes: una tarea lenta no se ejecuta dos veces a la vez', async () => {
  const t = temporizadorFalso();
  let enCurso = 0; let maximo = 0; let liberar;
  const tareas = [{ nombre: 'lenta', cadaMin: 1, ejecutar: () => new Promise((resolver) => {
    enCurso += 1; maximo = Math.max(maximo, enCurso);
    liberar = () => { enCurso -= 1; resolver('ok'); };
  }) }];
  const r = crearRecolector({ tareas, logger: silencio, ...t });
  r.iniciar();
  const primera = t.disparar(0);
  await pausa();
  assert.strictEqual(r.estado()[0].corriendo, true);
  assert.strictEqual(t.pendientes.length, 0); // mientras corre, no hay otra programada
  liberar();
  await primera;
  assert.strictEqual(maximo, 1);
  assert.strictEqual(t.pendientes.length, 1); // recién al terminar se programa la siguiente
  await r.detener();
});

test('detener cancela lo pendiente y espera a la tarea en curso', async () => {
  const t = temporizadorFalso();
  let terminada = false; let liberar;
  const tareas = [{ nombre: 'x', cadaMin: 1, ejecutar: () => new Promise((resolver) => { liberar = () => { terminada = true; resolver('ok'); }; }) }];
  const r = crearRecolector({ tareas, logger: silencio, ...t });
  r.iniciar();
  t.disparar(0);
  await pausa();
  const parada = r.detener();
  await pausa();
  assert.strictEqual(terminada, false); // todavía esperando
  liberar();
  await parada;
  assert.strictEqual(terminada, true);
  assert.strictEqual(t.pendientes.length, 0); // no queda nada programado
});

test('sin tareas el recolector arranca y se detiene sin error', async () => {
  const t = temporizadorFalso();
  const r = crearRecolector({ tareas: [], logger: silencio, ...t });
  r.iniciar();
  await r.detener();
  assert.deepStrictEqual(r.estado(), []);
});
