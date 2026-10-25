// Contrato de los adaptadores de fuentes. JavaScript no tiene "interfaces", así que lo expresamos como
// una convención verificable: un adaptador es un objeto con
//   - nombre:   texto que identifica la fuente ('bcb', 'frankfurter', …)
//   - obtener(): async, devuelve un arreglo de Observaciones (ver observacion.js)
// Los servicios reciben adaptadores desde afuera (inyección de dependencias) y no saben cuál es cuál.

function verificarAdaptador(a) {
  if (!a || typeof a.nombre !== 'string' || a.nombre === '') {
    throw new Error('Adaptador inválido: falta "nombre"');
  }
  if (typeof a.obtener !== 'function') {
    throw new Error(`Adaptador "${a.nombre}" inválido: falta obtener()`);
  }
  return a;
}

module.exports = { verificarAdaptador };
