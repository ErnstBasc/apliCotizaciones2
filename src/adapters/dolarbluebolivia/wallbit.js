// Dólar en la billetera Wallbit (vía dolarbluebolivia.click).
// Respuesta real (/v1/wallbit): { data: { currency: 'BOB', buy: 12.17, sell: 11.82, source: 'wallbit', fetched_at } }
// ATENCIÓN: Wallbit usa la perspectiva del CLIENTE (confirmado por el usuario en la app):
//   buy  = lo que PAGAS por comprar 1 USD  → nuestra VENTA (el precio mayor)
//   sell = lo que RECIBES al vender 1 USD  → nuestra COMPRA (el precio menor)
// (En el paralelo de dolarbluebolivia es al revés: buy < sell. Cada adaptador normaliza lo suyo.)
const { crearObservacion } = require('../../contracts/observacion');
const { fechaBolivia } = require('../../utilidades/fechas');

const valido = (v) => typeof v === 'number' && v > 1 && v < 100;

function convertir(json) {
  const d = json && json.data;
  if (!d) throw new Error('Wallbit: falta "data" en la respuesta');
  if (!valido(d.buy) || !valido(d.sell)) throw new Error(`Wallbit: precios inválidos (buy=${d.buy}, sell=${d.sell})`);
  if (d.buy < d.sell) throw new Error(`Wallbit: el precio de compra del cliente (${d.buy}) es menor que el de venta (${d.sell}); revisar el formato`);
  const instante = d.fetched_at ? new Date(d.fetched_at) : null;
  return crearObservacion({
    instrumento: 'BOB_BILLETERA', entidad: 'wallbit', valor: d.buy, venta: d.buy, compra: d.sell,
    unidad: 'Bs por USD', fecha: instante && !Number.isNaN(instante.getTime()) ? fechaBolivia(instante) : null,
  });
}

function crearAdaptadorWallbit({ cliente }) {
  return {
    nombre: 'dolarbluebolivia',
    instrumentos: ['BOB_BILLETERA'],
    async obtener() {
      return [convertir(await cliente.obtenerJson('/v1/wallbit'))];
    },
  };
}

module.exports = { crearAdaptadorWallbit, convertir };
