// Decorador: envuelve un adaptador principal con uno de respaldo (patrón Decorator / fallback).
// Si el principal falla, prueba el respaldo; el resultado indica QUÉ fuente respondió, para guardarlo así.
// Los servicios no saben que hay dos fuentes: ven un solo adaptador. (Liskov: sustituible por cualquiera.)
//
// Contrato extendido: obtener() puede devolver un arreglo (la fuente es adaptador.nombre) o
// { fuente, observaciones } cuando la fuente que respondió puede variar.
function conRespaldo(principal, respaldo, { logger = console } = {}) {
  const faltan = principal.instrumentos.filter((i) => !respaldo.instrumentos.includes(i));
  if (faltan.length) throw new Error(`conRespaldo: el respaldo no cubre ${faltan.join(', ')}`);

  return {
    nombre: principal.nombre,
    instrumentos: principal.instrumentos,
    async obtener() {
      try {
        return { fuente: principal.nombre, observaciones: await principal.obtener() };
      } catch (errPrincipal) {
        logger.error(`[respaldo] falló "${principal.nombre}" (${errPrincipal.message}); probando "${respaldo.nombre}"`);
        try {
          return { fuente: respaldo.nombre, observaciones: await respaldo.obtener() };
        } catch (errRespaldo) {
          throw new Error(`fallaron ambas fuentes: ${principal.nombre} (${errPrincipal.message}) y ${respaldo.nombre} (${errRespaldo.message})`);
        }
      }
    },
  };
}

module.exports = { conRespaldo };
