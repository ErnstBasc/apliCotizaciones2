// Dólar en plataformas digitales (Airtm, Takenos, El Dorado y Bitget P2P), leído de dolarbluebolivia.click.
// Cada plataforma publica sus dos precios con nombres distintos; aquí se normalizan a nuestra convención:
//   venta  = lo que PAGAS al comprar 1 USD (el precio mayor)   compra = lo que RECIBES al vender 1 USD (el menor)
// Respuestas reales (31-oct-2026), todas con la forma { data: {…, fetched_at}, cached, … }:
//   /v1/airtm        data: { addValue: 12.09, withdrawValue: 11.58 }          (depositar saldo / retirar saldo)
//   /v1/takenos      data: { buy: 12.35, sell: 11.93 }
//   /v1/eldorado     data: { buy: 12.1,  sell: 11.93 }
//   /v1/p2p/bitget   data: { buy: 12.09, sell: 12.05, congelado: false }
// Todas se guardan como instrumento BOB_BILLETERA con su propia entidad, y salen juntas en GET /billeteras.
const { crearObservacion } = require('../../contracts/observacion');
const { fechaBolivia } = require('../../utilidades/fechas');

// Para sumar otra plataforma de dolarbluebolivia basta una entrada aquí (más su fila en la tabla entidades).
const PLATAFORMAS = {
  airtm: { ruta: '/v1/airtm', nombre: 'Airtm', venta: (d) => d.addValue, compra: (d) => d.withdrawValue },
  takenos: { ruta: '/v1/takenos', nombre: 'Takenos', venta: (d) => d.buy, compra: (d) => d.sell },
  eldorado: { ruta: '/v1/eldorado', nombre: 'El Dorado', venta: (d) => d.buy, compra: (d) => d.sell },
  bitget: { ruta: '/v1/p2p/bitget', nombre: 'Bitget P2P', venta: (d) => d.buy, compra: (d) => d.sell },
};

const valido = (v) => typeof v === 'number' && v > 1 && v < 100;

function convertir(codigo, json) {
  const p = PLATAFORMAS[codigo];
  if (!p) throw new Error(`Plataforma desconocida: ${codigo}`);
  const d = json && json.data;
  if (!d) throw new Error(`${p.nombre}: falta "data" en la respuesta`);
  const venta = p.venta(d);
  const compra = p.compra(d);
  if (!valido(venta) || !valido(compra)) throw new Error(`${p.nombre}: precios inválidos (venta=${venta}, compra=${compra})`);
  if (venta < compra) throw new Error(`${p.nombre}: la venta (${venta}) es menor que la compra (${compra}); revisar el formato`);
  const instante = new Date(d.fetched_at ?? json.fetched_at ?? NaN);
  return crearObservacion({
    instrumento: 'BOB_BILLETERA', entidad: codigo, valor: venta, venta, compra, unidad: 'Bs por USD',
    fecha: Number.isNaN(instante.getTime()) ? null : fechaBolivia(instante),
    // Bitget avisa cuando su precio está "congelado" (sin datos nuevos): no lo presentamos como vigente
    estado: d.congelado === true ? 'desactualizado' : 'vigente',
  });
}

function crearAdaptadorPlataforma({ cliente, codigo }) {
  const p = PLATAFORMAS[codigo];
  if (!p) throw new Error(`Plataforma desconocida: ${codigo}`);
  return {
    nombre: 'dolarbluebolivia',
    instrumentos: ['BOB_BILLETERA'],
    async obtener() {
      return [convertir(codigo, await cliente.obtenerJson(p.ruta))];
    },
  };
}

const crearAdaptadoresPlataformas = ({ cliente }) => Object.keys(PLATAFORMAS).map((codigo) => crearAdaptadorPlataforma({ cliente, codigo }));

module.exports = { PLATAFORMAS, convertir, crearAdaptadorPlataforma, crearAdaptadoresPlataformas };
