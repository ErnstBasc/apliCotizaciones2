const test = require('node:test');
const assert = require('node:assert');
const { crearRepositorioUsuarios } = require('../src/repositories/usuariosRepositorio');

function dbFalsa(filas = [], rowCount = 1) {
  const db = { llamadas: [] };
  db.query = async (sql, params) => { db.llamadas.push({ sql, params }); return { rows: filas, rowCount }; };
  return db;
}
const FILA = { id: '4', correo: 'ana@ejemplo.com', clave_hash: 'h', rol: 'registrado', verificado_en: null, intentos_fallidos: 0, bloqueado_hasta: null, version_sesion: 2, creado_en: '2026-10-31T12:00:00Z' };

test('todas las consultas son parametrizadas: ningún dato aparece dentro del SQL', async () => {
  const db = dbFalsa([FILA]);
  const repo = crearRepositorioUsuarios(db);
  const peligro = "x'; DROP TABLE usuarios; --@a.com";
  await repo.crear({ correo: peligro, claveHash: 'hash-secreto' });
  await repo.buscarPorCorreo(peligro);
  await repo.guardarToken({ usuarioId: 1, tipo: 'verificacion', tokenHash: 'abc', expiraEn: new Date() });
  await repo.consumirToken({ tokenHash: 'abc', tipo: 'recuperacion', ahora: new Date() });
  for (const { sql } of db.llamadas) {
    assert.ok(!sql.includes('DROP') && !sql.includes('hash-secreto') && !sql.includes('abc'), sql);
    assert.match(sql, /\$1/);
  }
});

test('crear: convierte la fila (id numérico, fechas, nombres en español) y devuelve null si el correo ya existía', async () => {
  const u = await crearRepositorioUsuarios(dbFalsa([FILA])).crear({ correo: 'ana@ejemplo.com', claveHash: 'h' });
  assert.strictEqual(u.id, 4);
  assert.strictEqual(u.versionSesion, 2);
  assert.ok(u.creadoEn instanceof Date);
  assert.strictEqual(u.verificadoEn, null);
  assert.strictEqual(await crearRepositorioUsuarios(dbFalsa([])).crear({ correo: 'a@b.co', claveHash: 'h' }), null);
});

test('crear usa ON CONFLICT; consumirToken marca y devuelve en una sola sentencia con las condiciones de vigencia', async () => {
  const db = dbFalsa([{ usuario_id: '9' }]);
  const repo = crearRepositorioUsuarios(db);
  await repo.crear({ correo: 'a@b.co', claveHash: 'h' });
  assert.match(db.llamadas[0].sql, /ON CONFLICT \(correo\) DO NOTHING/);
  assert.strictEqual(await repo.consumirToken({ tokenHash: 'h', tipo: 'verificacion', ahora: new Date() }), 9);
  const { sql } = db.llamadas[1];
  assert.match(sql, /UPDATE tokens_usuario/);
  assert.match(sql, /usado_en IS NULL/);
  assert.match(sql, /expira_en > \$3/);
  assert.match(sql, /RETURNING usuario_id/);
  assert.strictEqual(await crearRepositorioUsuarios(dbFalsa([])).consumirToken({ tokenHash: 'h', tipo: 'verificacion', ahora: new Date() }), null);
});

test('actualizarClave sube la versión de sesión y limpia el bloqueo; guardarToken reemplaza los pendientes', async () => {
  const db = dbFalsa([FILA]);
  const repo = crearRepositorioUsuarios(db);
  await repo.actualizarClave(4, 'nuevo');
  assert.match(db.llamadas[0].sql, /version_sesion = version_sesion \+ 1/);
  assert.match(db.llamadas[0].sql, /bloqueado_hasta = NULL/);
  await repo.guardarToken({ usuarioId: 4, tipo: 'recuperacion', tokenHash: 'h', expiraEn: new Date() });
  assert.match(db.llamadas[1].sql, /DELETE FROM tokens_usuario[\s\S]*usado_en IS NULL/);
});
