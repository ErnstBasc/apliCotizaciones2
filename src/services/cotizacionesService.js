// Casos de uso de lectura de cotizaciones: combina adaptadores + caché + vigencias configuradas.
// No sabe de HTTP ni de SQL. Crece paso a paso: monedas, oficial, (luego) paralelo, bancos, etc.
// Una entidad que ya no aparece en la última lectura conserva su fila vieja en la base. Para no mostrarla como
// vigente para siempre, toda fila que no se refrescó junto con las demás (más de 60 s antes) pasa a "desactualizado".
function marcarNoRefrescadas(observaciones, toleranciaMs = 60_000) {
  if (observaciones.length === 0) return observaciones;
  const ultima = Math.max(...observaciones.map((o) => o.obtenidoEn.getTime()));
  return observaciones.map((o) => (ultima - o.obtenidoEn.getTime() > toleranciaMs ? { ...o, estado: 'desactualizado' } : o));
}

// Resumen del mercado de bancos: ordenados por venta y con la mejor opción para comprar y para vender dólares.
function resumirBancos(observaciones) {
  const vigentes = observaciones.filter((o) => o.estado === 'vigente');
  const conVenta = vigentes.filter((o) => o.venta !== null);
  const conCompra = vigentes.filter((o) => o.compra !== null);
  const mejor = (lista, campo, signo) =>
    lista.length ? lista.reduce((a, b) => (signo * (b[campo] - a[campo]) < 0 ? b : a)) : null;
  const barato = mejor(conVenta, 'venta', 1);   // menor venta = más barato para comprar dólares
  const caro = mejor(conCompra, 'compra', -1);  // mayor compra = mejor para vender dólares
  // Primero los vigentes (de menor a mayor venta) y al final los desactualizados, para no destacar un precio viejo
  const porVenta = [...observaciones].sort(
    (a, b) => (a.estado !== 'vigente') - (b.estado !== 'vigente') || (a.venta ?? Infinity) - (b.venta ?? Infinity)
  );
  return {
    bancos: porVenta,
    resumen: {
      bancos_con_precio: vigentes.length,
      mejor_para_comprar: barato ? { entidad: barato.entidad, venta: barato.venta } : null,
      mejor_para_vender: caro ? { entidad: caro.entidad, compra: caro.compra } : null,
    },
  };
}

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
    async billeteras() {
      const r = await leer(adaptadores.billeteras, cacheMin.billeteras);
      return { ...r, observaciones: marcarNoRefrescadas(r.observaciones) };
    },
    async bancos() {
      const r = await leer(adaptadores.bancos, cacheMin.bancos);
      return { ...r, ...resumirBancos(marcarNoRefrescadas(r.observaciones)) };
    },
  };
}

module.exports = { crearServicioCotizaciones, marcarNoRefrescadas, resumirBancos };
