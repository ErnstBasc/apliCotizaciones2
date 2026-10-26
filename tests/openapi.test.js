const test = require('node:test');
const assert = require('node:assert');
const spec = require('../src/docs');

// Recorre el objeto y devuelve todas las referencias $ref
function referencias(obj, acumulado = []) {
  if (Array.isArray(obj)) obj.forEach((x) => referencias(x, acumulado));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k === '$ref') acumulado.push(v); else referencias(v, acumulado);
    }
  }
  return acumulado;
}

test('la documentación cubre exactamente las rutas de la API', () => {
  assert.deepStrictEqual(Object.keys(spec.paths).sort(), [
    '/bancos', '/billeteras', '/comparacion', '/convertir', '/cotizaciones', '/health', '/indicadores', '/monedas', '/oficial', '/paralelo',
  ]);
});

test('todas las referencias $ref apuntan a un esquema que existe', () => {
  const refs = referencias(spec);
  assert.ok(refs.length > 0);
  for (const r of refs) {
    const nombre = r.replace('#/components/schemas/', '');
    assert.ok(spec.components.schemas[nombre], `esquema inexistente: ${r}`);
  }
});

test('cada operación tiene etiqueta declarada, resumen y respuesta 200', () => {
  const etiquetas = spec.tags.map((t) => t.name);
  for (const [ruta, ops] of Object.entries(spec.paths)) {
    for (const [metodo, op] of Object.entries(ops)) {
      assert.ok(op.summary, `${metodo} ${ruta} sin resumen`);
      assert.ok(op.responses[200], `${metodo} ${ruta} sin respuesta 200`);
      assert.ok(op.tags.every((t) => etiquetas.includes(t)), `${metodo} ${ruta} usa una etiqueta no declarada`);
    }
  }
});

test('/convertir documenta sus 5 parámetros y la respuesta 400', () => {
  const op = spec.paths['/convertir'].get;
  assert.deepStrictEqual(op.parameters.map((p) => p.name), ['monto', 'de', 'a', 'tasa', 'lado']);
  assert.ok(op.responses[400]);
  assert.ok(op.parameters.find((p) => p.name === 'de').schema.enum.includes('PYG'));
});

test('la especificación se puede serializar a JSON sin pérdida', () => {
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(spec)));
});
