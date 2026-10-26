// Bancos comerciales de Bolivia (vía dolarbluebolivia.click, /v1/bancos).
// Cada banco trae su "pizarra" (precios que publica en su web): { compra, venta, fecha, estado }.
//   compra = lo que el banco te PAGA por tus dólares; venta = lo que TÚ pagas por comprar un dólar.
// Estados de la pizarra: 'vigente' | 'desactualizado' (se guarda así) | 'no_leido' (se omite, no hay precio).
// Ganadero publica solo la venta: la compra queda en null.
const { crearObservacion } = require('../../contracts/observacion');

// Bancos sembrados en la tabla "entidades". Uno desconocido se omite (y se registra) en vez de guardarse sin entidad.
const BANCOS_CONOCIDOS = ['fie', 'bisa', 'bcp', 'bnb', 'fortaleza', 'ganadero', 'union', 'bancosol', 'mercantil', 'economico', 'prodem'];
const precioONull = (v) => (typeof v === 'number' && v > 1 && v < 100 ? v : null);

function convertir(json, logger = console) {
  const bancos = json && json.data && json.data.bancos;
  if (!Array.isArray(bancos)) throw new Error('bancos: falta data.bancos en la respuesta');

  const observaciones = [];
  for (const b of bancos) {
    const p = b.pizarra;
    if (!p || p.estado === 'no_leido') continue;
    if (!BANCOS_CONOCIDOS.includes(b.id)) { logger.error(`[bancos] banco desconocido omitido: "${b.id}"`); continue; }
    const compra = precioONull(p.compra);
    const venta = precioONull(p.venta);
    if (compra === null && venta === null) continue;
    try {
      observaciones.push(crearObservacion({
        instrumento: 'BOB_BANCO', entidad: b.id, valor: venta, compra, venta, unidad: 'Bs por USD',
        fecha: p.fecha ?? null, estado: p.estado === 'vigente' ? 'vigente' : 'desactualizado',
      }));
    } catch (e) { logger.error(`[bancos] ${b.id}: ${e.message}`); }
  }
  if (observaciones.length === 0) throw new Error('bancos: ningún banco con precio utilizable');
  return observaciones;
}

function crearAdaptadorBancos({ cliente, logger = console }) {
  return {
    nombre: 'dolarbluebolivia',
    instrumentos: ['BOB_BANCO'],
    async obtener() {
      return convertir(await cliente.obtenerJson('/v1/bancos'), logger);
    },
  };
}

module.exports = { crearAdaptadorBancos, convertir, BANCOS_CONOCIDOS };
