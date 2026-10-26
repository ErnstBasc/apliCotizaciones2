// Respaldo del dólar paralelo: lectura agregada de plataformas P2P hecha por dolarbluebolivia.click.
// Respuesta real (/v1/officialRate): { data: { blue: { buy: 11.96, sell: 12.01 }, official: {…}, fetched_at } }
// En "blue", buy = lo que recibes al vender (nuestra compra) y sell = lo que pagas al comprar (nuestra venta).
const { crearObservacion } = require('../../contracts/observacion');
const { fechaBolivia } = require('../../utilidades/fechas');

function convertir(json) {
  const blue = json && json.data && json.data.blue;
  if (!blue) throw new Error('dolarbluebolivia: falta data.blue en la respuesta');
  const { buy, sell } = blue;
  for (const [nombre, v] of [['buy', buy], ['sell', sell]]) {
    if (!(typeof v === 'number' && v > 1 && v < 100)) throw new Error(`dolarbluebolivia: "${nombre}" inválido (${v})`);
  }
  const instante = json.data.fetched_at ? new Date(json.data.fetched_at) : null;
  const fecha = instante && !Number.isNaN(instante.getTime()) ? fechaBolivia(instante) : null;
  return crearObservacion({
    instrumento: 'BOB_PARALELO', entidad: 'binance', valor: sell, compra: buy, venta: sell, unidad: 'Bs por USD', fecha,
  });
}

function crearAdaptadorParaleloRespaldo({ cliente }) {
  return {
    nombre: 'dolarbluebolivia',
    instrumentos: ['BOB_PARALELO'],
    async obtener() {
      return [convertir(await cliente.obtenerJson('/v1/officialRate'))];
    },
  };
}

module.exports = { crearAdaptadorParaleloRespaldo, convertir };
