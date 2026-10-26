// Orquesta los cálculos: pide los datos al servicio de cotizaciones y se los pasa a las funciones puras.
// Pide SOLO las fuentes que cada caso necesita (convertir con tasa oficial no consulta el paralelo).
const { ErrorFuente } = require('../errores');
const calc = require('./calculos');

const TIPO = { BOB_OFICIAL: 'referencia', BOB_PARALELO: 'exchange', BOB_BILLETERA: 'billetera', BOB_BANCO: 'banco' };

function crearServicioCalculos({ cotizaciones }) {
  const ladosOficial = (o) => ({ venta: o.venta ?? o.valor, compra: o.compra ?? o.valor });
  const desactualizado = (...rs) => rs.some((r) => r.desactualizado);

  return {
    async resumen() {
      const [m, o, p] = await Promise.all([cotizaciones.monedas(), cotizaciones.oficial(), cotizaciones.paralelo()]);
      return {
        base: 'USD',
        desactualizado: desactualizado(m, o, p),
        ...calc.construirResumen({
          oficial: ladosOficial(o.observaciones[0]),
          paralelo: ladosOficial(p.observaciones[0]),
          monedas: m.observaciones.map((x) => ({ codigo: x.instrumento, nombre: x.nombre, valor: x.valor })),
        }),
      };
    },

    // consulta ya validada: { monto, de, a, tasa, lado }
    async convertir({ monto, de, a, tasa, lado }) {
      const necesitaBob = de === 'BOB' || a === 'BOB';
      const [m, b] = await Promise.all([
        cotizaciones.monedas(),
        necesitaBob ? (tasa === 'oficial' ? cotizaciones.oficial() : cotizaciones.paralelo()) : null,
      ]);
      const bob = b ? ladosOficial(b.observaciones[0])[lado] : null;
      const unidades = calc.unidadesPorUsd({
        bob,
        monedas: m.observaciones.map((x) => ({ codigo: x.instrumento, valor: x.valor })),
      });
      return {
        monto, de, a, tasa, lado,
        resultado: calc.redondear(calc.convertirMonto(monto, de, a, unidades), 4),
        desactualizado: desactualizado(m, ...(b ? [b] : [])),
      };
    },

    // Compara dónde comprar/vender dólares. Tolera que alguna fuente falle: usa las demás.
    async comparacion() {
      const nombres = ['oficial', 'paralelo', 'billeteras', 'bancos'];
      const resultados = await Promise.allSettled(nombres.map((n) => cotizaciones[n]()));
      const buenos = resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      if (buenos.length === 0) throw new ErrorFuente('oficial, paralelo, billeteras y bancos', 'todas las fuentes fallaron');
      const fuentesConError = nombres.filter((_, i) => resultados[i].status === 'rejected');

      const entradas = buenos.flatMap((r) => r.observaciones).map((o) => ({
        entidad: o.entidad, nombre: o.entidadNombre ?? o.entidad, tipo: TIPO[o.instrumento] ?? 'otro',
        compra: o.compra, venta: o.venta, estado: o.estado,
      }));
      const oficial = entradas.find((e) => e.tipo === 'referencia');
      return {
        base: 'USD',
        cotizada: 'BOB',
        desactualizado: buenos.some((r) => r.desactualizado),
        fuentes_con_error: fuentesConError,
        referencia_oficial: oficial ? oficial.venta : null,
        ...calc.construirComparacion(entradas, oficial ? oficial.venta : null),
      };
    },
  };
}

module.exports = { crearServicioCalculos };
