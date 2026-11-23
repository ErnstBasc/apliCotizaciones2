const test = require('node:test');
const assert = require('node:assert');
const { crearServicioArticulos, aParrafos } = require('../src/services/articulosService');
const { crearRutasArticulos, manejadoresArticulos, MENSAJE_PREMIUM } = require('../src/routes/articulos');
const { crearAutenticacion } = require('../src/middleware/autenticacion');
const { crearServicioAdministradores } = require('../src/services/administradoresService');
const { crearRepositorioFalso, clavesFalsas } = require('./ayudas/usuariosFalso');
const v = require('../src/routes/validacion');

const ARTICULOS = [
  { id: 1, titulo: 'Uno', autor: 'A', resumen: 'R1', publicadoEn: '2026-11-22T14:00:00.000Z', cuerpo: 'Primer párrafo.\n\nSegundo párrafo.' },
  { id: 2, titulo: 'Dos', autor: 'B', resumen: 'R2', publicadoEn: '2026-11-21T14:00:00.000Z', cuerpo: 'Solo uno.' },
];
const repoFalso = {
  listar: async () => ARTICULOS.map(({ cuerpo, ...resto }) => resto),
  obtener: async (id) => ARTICULOS.find((a) => a.id === id) || null,
};
const servicio = crearServicioArticulos({ repositorio: repoFalso });

test('la lista pública trae títulos y resúmenes, nunca el cuerpo', async () => {
  const r = await servicio.listar();
  assert.strictEqual(r.articulos.length, 2);
  assert.ok(r.articulos.every((a) => !('cuerpo' in a) && !('parrafos' in a)));
  assert.deepStrictEqual(r.lectores, ['premium', 'admin']);
});

test('leer entrega el artículo dividido en párrafos; 404 si no existe', async () => {
  const { articulo } = await servicio.leer(1);
  assert.deepStrictEqual(articulo.parrafos, ['Primer párrafo.', 'Segundo párrafo.']);
  assert.ok(!('cuerpo' in articulo));
  await assert.rejects(() => servicio.leer(99), (e) => e.estado === 404);
});

test('aParrafos: separa por línea en blanco (también con \\r\\n) y descarta vacíos', () => {
  assert.deepStrictEqual(aParrafos('a\r\n\r\nb\n \n\nc'), ['a', 'b', 'c']);
  assert.deepStrictEqual(aParrafos('una línea\nsigue igual'), ['una línea\nsigue igual']);
});

test('validarIdArticulo: solo enteros positivos cortos', () => {
  assert.strictEqual(v.validarIdArticulo({ id: '3' }), 3);
  for (const malo of ['0x1', '-1', '1.5', 'a', '', '1234567890']) assert.throws(() => v.validarIdArticulo({ id: malo }), /artículo/, malo);
});

// --- Autorización: exigirRol (se prueba contra usuarios del repositorio falso, el rol se lee "de la base")
function pasar(guardia, usuario) {
  let error; guardia({ usuario }, {}, (e) => { error = e; }); return error;
}

test('exigirRol premium/admin: sin sesión 401, común 403 con el mensaje premium, premium y admin pasan', () => {
  const { exigirRol } = crearAutenticacion({ sesiones: {}, usuarios: {} });
  const guardia = exigirRol(['premium', 'admin'], MENSAJE_PREMIUM);
  assert.strictEqual(pasar(guardia, undefined).estado, 401);
  const comun = pasar(guardia, { rol: 'registrado' });
  assert.strictEqual(comun.estado, 403);
  assert.strictEqual(comun.message, MENSAJE_PREMIUM);
  assert.strictEqual(pasar(guardia, { rol: 'premium' }), undefined);
  assert.strictEqual(pasar(guardia, { rol: 'admin' }), undefined);
});

test('rutas: la lista es pública; el detalle exige sesión y luego rol, en ese orden', () => {
  const registro = [];
  const router = { get: (ruta, ...m) => registro.push([ruta, m]) };
  const autenticacion = { exigirSesion: function exigirSesion() {}, exigirRol: () => function exigirRolPermitido() {} };
  crearRutasArticulos({ Router: () => router }, { articulos: servicio, autenticacion });
  const [lista, detalle] = registro;
  assert.strictEqual(lista[0], '/');
  assert.strictEqual(lista[1].length, 1); // solo el manejador: sin guardias
  assert.strictEqual(detalle[0], '/:id');
  assert.deepStrictEqual(detalle[1].slice(0, 2).map((f) => f.name), ['exigirSesion', 'exigirRolPermitido']);
});

test('el detalle responde sin caché compartida y valida el id', async () => {
  const h = manejadoresArticulos(servicio);
  const res = { cabeceras: {}, setHeader(k, x) { this.cabeceras[k] = x; }, json(c) { this.cuerpo = c; } };
  await h.leer({ params: { id: '2' } }, res, (e) => { throw e; });
  assert.strictEqual(res.cabeceras['Cache-Control'], 'private, no-store');
  assert.deepStrictEqual(res.cuerpo.articulo.parrafos, ['Solo uno.']);
  let error; await h.leer({ params: { id: 'x' } }, res, (e) => { error = e; });
  assert.strictEqual(error.estado, 400);
});

// --- Asignar el rol premium (script npm run usuario:rol)
test('asignar premium: solo a cuentas existentes, nunca a un administrador; y se puede quitar', async () => {
  const repositorio = crearRepositorioFalso();
  const admins = crearServicioAdministradores({ repositorio, claves: clavesFalsas });
  await repositorio.crear({ correo: 'ana@ejemplo.com', claveHash: 'x' });
  assert.deepStrictEqual(await admins.asignarRol({ correo: 'ANA@ejemplo.com', rol: 'premium' }), { correo: 'ana@ejemplo.com', rol: 'premium' });
  assert.deepStrictEqual(await admins.asignarRol({ correo: 'ana@ejemplo.com', rol: 'registrado' }), { correo: 'ana@ejemplo.com', rol: 'registrado' });
  assert.strictEqual(await admins.asignarRol({ correo: 'nadie@ejemplo.com', rol: 'premium' }), null);
  await admins.crear({ correo: 'jefe@ejemplo.com', clave: 'clave-de-admin-123' });
  assert.strictEqual(await admins.asignarRol({ correo: 'jefe@ejemplo.com', rol: 'premium' }), null);
  await assert.rejects(() => admins.asignarRol({ correo: 'ana@ejemplo.com', rol: 'admin' }), /registrado o premium/);
});
