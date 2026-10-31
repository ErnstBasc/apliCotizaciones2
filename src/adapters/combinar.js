// Decorador "combinar": junta varios adaptadores de la MISMA fuente en uno solo (patrón Composite).
// Los servicios ven un único adaptador; si uno de los componentes falla, los demás siguen respondiendo
// (degradación parcial). Solo si fallan TODOS se lanza error. Lo que no se refrescó queda marcado como
// desactualizado más adelante (ver marcarNoRefrescadas en cotizacionesService.js).
function combinar(adaptadores, { logger = console } = {}) {
  if (!Array.isArray(adaptadores) || adaptadores.length === 0) throw new Error('combinar: falta la lista de adaptadores');
  const [{ nombre }] = adaptadores;
  if (adaptadores.some((a) => a.nombre !== nombre)) {
    throw new Error(`combinar: todos los adaptadores deben ser de la misma fuente (${nombre})`);
  }
  const instrumentos = [...new Set(adaptadores.flatMap((a) => a.instrumentos))];

  return {
    nombre,
    instrumentos,
    async obtener() {
      const resultados = await Promise.allSettled(adaptadores.map((a) => a.obtener()));
      const observaciones = [];
      const errores = [];
      resultados.forEach((r, i) => {
        if (r.status === 'rejected') errores.push(r.reason.message);
        else if (!Array.isArray(r.value)) errores.push(`componente ${i + 1}: devolvió un formato inesperado`);
        else observaciones.push(...r.value);
      });
      for (const e of errores) logger.error(`[combinar] falló un componente de "${nombre}": ${e}`);
      if (observaciones.length === 0) throw new Error(`fallaron todos los componentes de "${nombre}": ${errores.join('; ')}`);
      return observaciones;
    },
  };
}

module.exports = { combinar };
