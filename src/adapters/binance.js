// Dólar paralelo desde Binance P2P (USDT/BOB). OJO: endpoint NO oficial (el que usa la propia web de Binance);
// puede cambiar o bloquearse. Por eso este adaptador se usa con respaldo (ver conRespaldo.js).
//
// Cómo se calcula (mediana de los mejores anuncios de cada lado, porque el promedio se deja engañar por anuncios raros):
//   venta  = mediana de los anuncios BUY  → lo que pagas tú al COMPRAR USDT
//   compra = mediana de los anuncios SELL → lo que recibes tú al VENDER USDT
// Se descartan anuncios con monto mínimo muy alto (poco accesibles). 1 USDT ≈ 1 USD.
const { crearObservacion } = require('../contracts/observacion');
const { pedirTexto } = require('./http');
const { mediana, redondear } = require('../utilidades/estadistica');
const { fechaBolivia } = require('../utilidades/fechas');

const URL_BINANCE = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

function precios(json, montoMinimoMaxBs) {
  const lista = JSON.parse(json).data;
  if (!Array.isArray(lista)) throw new Error('Binance: formato inesperado (falta "data")');
  return lista
    .filter((x) => x && x.adv && Number(x.adv.minSingleTransAmount) <= montoMinimoMaxBs)
    .map((x) => Number(x.adv.price))
    .filter((p) => Number.isFinite(p) && p > 1 && p < 100);
}

function crearAdaptadorBinance({
  fetchFn = globalThis.fetch, timeoutMs = 10_000, filas = 10, montoMinimoMaxBs = 3000, minimoAnuncios = 3, reloj = () => Date.now(),
} = {}) {
  const pedirLado = async (tradeType) => {
    const cuerpo = await pedirTexto(fetchFn, URL_BINANCE, {
      timeoutMs,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fiat: 'BOB', asset: 'USDT', tradeType, page: 1, rows: filas, payTypes: [], publisherType: null }),
    });
    const p = precios(cuerpo, montoMinimoMaxBs);
    if (p.length < minimoAnuncios) throw new Error(`Binance ${tradeType}: solo ${p.length} anuncios utilizables (mínimo ${minimoAnuncios})`);
    return redondear(mediana(p));
  };

  return {
    nombre: 'binance',
    instrumentos: ['BOB_PARALELO'],
    async obtener() {
      const [venta, compra] = await Promise.all([pedirLado('BUY'), pedirLado('SELL')]);
      if (venta < compra * 0.95 || venta > compra * 1.05) {
        throw new Error(`Binance: venta (${venta}) y compra (${compra}) incoherentes entre sí`);
      }
      return [crearObservacion({
        instrumento: 'BOB_PARALELO', entidad: 'binance', valor: venta, compra, venta,
        unidad: 'Bs por USD', fecha: fechaBolivia(reloj()),
      })];
    },
  };
}

module.exports = { crearAdaptadorBinance, precios };
