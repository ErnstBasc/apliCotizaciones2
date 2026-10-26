// Cálculos puros: sin base de datos, sin red, sin Express. Reciben números y devuelven números.
// Por eso son fáciles de probar y de explicar. Convención: todo parte de "1 USD = X".

function redondear(n, decimales = 6) {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

// Brecha porcentual entre el paralelo y el oficial (ambos en Bs por USD)
const brechaPorcentaje = (paralelo, oficial) => redondear((paralelo / oficial - 1) * 100, 2);

// Cuántas unidades de cada moneda hay en 1 USD, usando el lado y la tasa elegidos para el boliviano
function unidadesPorUsd({ bob, monedas }) {
  const unidades = { USD: 1, BOB: bob };
  for (const m of monedas) unidades[m.codigo] = m.valor;
  return unidades;
}

// Conversión pasando SIEMPRE por el dólar: origen → USD → destino
function convertirMonto(cantidad, de, a, unidades) {
  for (const codigo of [de, a]) {
    if (!(codigo in unidades)) throw new Error(`moneda sin tasa: ${codigo}`);
  }
  if (de === a) return cantidad; // evita ruido de coma flotante (50 → 50.00000000000001)
  return (cantidad / unidades[de]) * unidades[a];
}

// Resumen: el dólar en bolivianos y cada moneda en USD y en bolivianos (venta primero, luego compra)
function construirResumen({ oficial, paralelo, monedas }) {
  return {
    dolar_boliviano: {
      oficial: { venta: oficial.venta, compra: oficial.compra },
      paralelo: { venta: paralelo.venta, compra: paralelo.compra },
      brecha_porcentaje: brechaPorcentaje(paralelo.venta, oficial.venta),
    },
    monedas: monedas.map((m) => ({
      codigo: m.codigo,
      nombre: m.nombre,
      por_usd: m.valor, // 1 USD = X de esta moneda
      en_bob: {          // 1 unidad de esta moneda = X bolivianos
        oficial: { venta: redondear(oficial.venta / m.valor), compra: redondear(oficial.compra / m.valor) },
        paralelo: { venta: redondear(paralelo.venta / m.valor), compra: redondear(paralelo.compra / m.valor) },
      },
    })),
  };
}

// Comparación de lugares para comprar y vender dólares.
// entradas: [{ entidad, nombre, tipo, compra, venta, estado }]  (tipo 'referencia' = el oficial: se muestra, no compite)
//   comprar dólares → conviene la VENTA más baja;  vender dólares → conviene la COMPRA más alta.
function construirComparacion(entradas, oficialVenta) {
  const vigentes = entradas.filter((e) => e.estado === 'vigente');
  const conPrecio = (campo) => vigentes.filter((e) => e[campo] !== null);
  const fila = (e, campo) => ({
    entidad: e.entidad, nombre: e.nombre, tipo: e.tipo, precio: e[campo],
    ...(oficialVenta ? { diferencia_vs_oficial_pct: redondear((e[campo] / oficialVenta - 1) * 100, 2) } : {}),
  });
  const comprar = conPrecio('venta').sort((a, b) => a.venta - b.venta).map((e) => fila(e, 'venta'));
  const vender = conPrecio('compra').sort((a, b) => b.compra - a.compra).map((e) => fila(e, 'compra'));
  const operativo = (f) => f.tipo !== 'referencia';
  return {
    comprar_dolares: comprar,
    vender_dolares: vender,
    mejor_para_comprar: comprar.find(operativo) ?? null,
    mejor_para_vender: vender.find(operativo) ?? null,
    excluidas_por_desactualizadas: entradas.length - vigentes.length,
  };
}

module.exports = { redondear, brechaPorcentaje, unidadesPorUsd, convertirMonto, construirResumen, construirComparacion };
