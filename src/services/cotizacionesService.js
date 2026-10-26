// Casos de uso de lectura de cotizaciones: combina adaptadores + caché + vigencias configuradas.
// No sabe de HTTP ni de SQL. Crece paso a paso: monedas, oficial, (luego) paralelo, bancos, etc.
function crearServicioCotizaciones({ cache, adaptadores, cacheMin }) {
  // Ordena las observaciones según el orden declarado por el adaptador
  const ordenar = (resultado, adaptador) => ({
    ...resultado,
    observaciones: [...resultado.observaciones].sort(
      (a, b) => adaptador.instrumentos.indexOf(a.instrumento) - adaptador.instrumentos.indexOf(b.instrumento)
    ),
  });

  const leer = async (adaptador, vigenciaMin) =>
    ordenar(await cache.obtener({ adaptador, instrumentos: adaptador.instrumentos, vigenciaMin }), adaptador);

  return {
    monedas: () => leer(adaptadores.monedas, cacheMin.monedas),
    oficial: () => leer(adaptadores.oficial, cacheMin.oficial),
    indicadores: () => leer(adaptadores.indicadores, cacheMin.indicadores),
    paralelo: () => leer(adaptadores.paralelo, cacheMin.paralelo),
  };
}

module.exports = { crearServicioCotizaciones };
