// Contrato de los adaptadores de fuentes. JavaScript no tiene "interfaces", así que lo expresamos como
// una convención verificable: un adaptador es un objeto con
//   - nombre:   código de la fuente, igual al de la tabla fuentes ('bcb', 'frankfurter', …)
//   - instrumentos: códigos de instrumento que produce (el caché los usa para saber qué buscar)
//   - obtener(): async, devuelve un arreglo de Observaciones (ver observacion.js)
// Los servicios reciben adaptadores desde afuera (inyección de dependencias) y no saben cuál es cuál.

function verificarAdaptador(a) {
  if (!a || typeof a.nombre !== 'string' || a.nombre === '') {
    throw new Error('Adaptador inválido: falta "nombre"');
  }
  if (!Array.isArray(a.instrumentos) || a.instrumentos.length === 0) {
    throw new Error(`Adaptador "${a.nombre}" inválido: falta la lista "instrumentos"`);
  }
  if (typeof a.obtener !== 'function') {
    throw new Error(`Adaptador "${a.nombre}" inválido: falta obtener()`);
  }
  return a;
}

module.exports = { verificarAdaptador };
