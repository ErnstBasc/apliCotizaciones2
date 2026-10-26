const test = require('node:test');
const assert = require('node:assert');
const { crearCors } = require('../src/middleware/cors');

function ejecutar(cors, { origen, metodo = 'GET', previuelo = false }) {
  const req = { method: metodo, headers: {} };
  if (origen) req.headers.origin = origen;
  if (previuelo) req.headers['access-control-request-method'] = 'GET';
  const res = { cabeceras: {}, codigo: null, terminado: false };
  res.setHeader = (k, v) => { res.cabeceras[k] = v; };
  res.status = (c) => { res.codigo = c; return res; };
  res.end = () => { res.terminado = true; };
  let siguiente; let error;
  cors(req, res, (e) => { siguiente = true; error = e; });
  return { res, siguiente, error };
}

test('sin cabecera Origin (mismo origen, curl, Swagger): pasa sin tocar nada', () => {
  const r = ejecutar(crearCors(['http://localhost:5500']), {});
  assert.ok(r.siguiente);
  assert.deepStrictEqual(r.res.cabeceras, {});
});

test('origen permitido: recibe Allow-Origin con su propio origen y Vary', () => {
  const r = ejecutar(crearCors(['http://localhost:5500']), { origen: 'http://localhost:5500' });
  assert.ok(r.siguiente);
  assert.strictEqual(r.res.cabeceras['Access-Control-Allow-Origin'], 'http://localhost:5500');
  assert.strictEqual(r.res.cabeceras.Vary, 'Origin');
});

test('origen NO permitido: la petición pasa pero sin cabeceras CORS (el navegador la bloqueará)', () => {
  const r = ejecutar(crearCors(['http://localhost:5500']), { origen: 'http://sitio-malo.com' });
  assert.ok(r.siguiente);
  assert.ok(!('Access-Control-Allow-Origin' in r.res.cabeceras));
});

test('lista vacía (por defecto): nunca se conceden cabeceras', () => {
  const r = ejecutar(crearCors([]), { origen: 'http://localhost:5500' });
  assert.ok(!('Access-Control-Allow-Origin' in r.res.cabeceras));
});

test('comodín "*": cualquiera puede leer, sin credenciales', () => {
  const r = ejecutar(crearCors(['*']), { origen: 'http://cualquiera.com' });
  assert.strictEqual(r.res.cabeceras['Access-Control-Allow-Origin'], '*');
});

test('prevuelo permitido: responde 204 con métodos de solo lectura', () => {
  const r = ejecutar(crearCors(['http://localhost:5500']), { origen: 'http://localhost:5500', metodo: 'OPTIONS', previuelo: true });
  assert.strictEqual(r.res.codigo, 204);
  assert.ok(r.res.terminado);
  assert.ok(!r.siguiente);
  assert.strictEqual(r.res.cabeceras['Access-Control-Allow-Methods'], 'GET, HEAD, OPTIONS');
});

test('prevuelo de origen no permitido: error 403', () => {
  const r = ejecutar(crearCors(['http://localhost:5500']), { origen: 'http://sitio-malo.com', metodo: 'OPTIONS', previuelo: true });
  assert.strictEqual(r.error.estado, 403);
});
