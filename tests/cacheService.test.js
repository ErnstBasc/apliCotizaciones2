const test = require('node:test');
const assert = require('node:assert');
const { crearServicioCache } = require('../src/services/cacheService');
const { ErrorFuente } = require('../src/errores');

const silencio = { error() {} };
const obs = (valor, minutosAtras, ahora) => ({
  instrumento: 'EUR', entidad: null, valor, compra: null, venta: null, unidad: 'por USD',
  fecha: '2026-10-25', estado: 'vigente', obtenidoEn: new Date(ahora - minutosAtras * 60_000),
});

// Repositorio falso en memoria
function repoFalso(inicial = []) {
  const r = { filas: [...inicial], guardados: 0, lecturas: 0 };
  r.ultimas = async () => { r.lecturas++; return r.filas; };
  r.guardarVarias = async (nuevas) => {
    r.guardados++;
    r.filas = nuevas.map((o) => ({ ...o, obtenidoEn: new Date(r.ahora) }));
  };
  return r;
}
const adaptadorFalso = (valor, fallar = false) => {
  const a = { nombre: 'falso', llamadas: 0 };
  a.obtener = async () => { a.llamadas++; if (fallar) throw new Error('sin red'); return [{ instrumento: 'EUR', valor }]; };
  return a;
};
const AHORA = Date.parse('2026-10-25T12:00:00Z');
const montar = (repo) => { repo.ahora = AHORA; return crearServicioCache({ repositorio: repo, reloj: () => AHORA, logger: silencio }); };

test('dato vigente: responde desde la base sin consultar la fuente', async () => {
  const repo = repoFalso([obs(0.89, 5, AHORA)]);
  const a = adaptadorFalso(0.9);
  const r = await montar(repo).obtener({ adaptador: a, instrumentos: ['EUR'], vigenciaMin: 10 });
  assert.strictEqual(r.origen, 'cache');
  assert.strictEqual(r.desactualizado, false);
  assert.strictEqual(a.llamadas, 0);
});

test('dato vencido: consulta la fuente y guarda', async () => {
  const repo = repoFalso([obs(0.89, 15, AHORA)]);
  const a = adaptadorFalso(0.9);
  const r = await montar(repo).obtener({ adaptador: a, instrumentos: ['EUR'], vigenciaMin: 10 });
  assert.strictEqual(r.origen, 'falso');
  assert.strictEqual(a.llamadas, 1);
  assert.strictEqual(repo.guardados, 1);
  assert.strictEqual(r.observaciones[0].valor, 0.9);
});

test('vigencia 0: nunca usa caché', async () => {
  const repo = repoFalso([obs(0.89, 0, AHORA)]);
  const a = adaptadorFalso(0.9);
  const svc = montar(repo);
  await svc.obtener({ adaptador: a, instrumentos: ['EUR'], vigenciaMin: 0 });
  await svc.obtener({ adaptador: a, instrumentos: ['EUR'], vigenciaMin: 0 });
  assert.strictEqual(a.llamadas, 2);
});

test('sin datos guardados: consulta la fuente', async () => {
  const repo = repoFalso([]);
  const a = adaptadorFalso(0.9);
  const r = await montar(repo).obtener({ adaptador: a, instrumentos: ['EUR'], vigenciaMin: 10 });
  assert.strictEqual(a.llamadas, 1);
  assert.strictEqual(r.desactualizado, false);
});

test('la fuente falla y hay datos viejos: responde desactualizado', async () => {
  const repo = repoFalso([obs(0.89, 120, AHORA)]);
  const r = await montar(repo).obtener({ adaptador: adaptadorFalso(0, true), instrumentos: ['EUR'], vigenciaMin: 10 });
  assert.strictEqual(r.origen, 'cache');
  assert.strictEqual(r.desactualizado, true);
  assert.strictEqual(r.observaciones[0].valor, 0.89);
});

test('la fuente falla y no hay datos: ErrorFuente 502 sin filtrar el detalle', async () => {
  const repo = repoFalso([]);
  await assert.rejects(
    montar(repo).obtener({ adaptador: adaptadorFalso(0, true), instrumentos: ['EUR'], vigenciaMin: 10 }),
    (e) => e instanceof ErrorFuente && e.estado === 502 && !e.message.includes('sin red') && e.interno === 'sin red'
  );
});

test('peticiones simultáneas comparten una sola consulta a la fuente', async () => {
  const repo = repoFalso([]);
  const a = adaptadorFalso(0.9);
  const svc = montar(repo);
  const p = { adaptador: a, instrumentos: ['EUR'], vigenciaMin: 10 };
  await Promise.all([svc.obtener(p), svc.obtener(p), svc.obtener(p)]);
  assert.strictEqual(a.llamadas, 1);
});
