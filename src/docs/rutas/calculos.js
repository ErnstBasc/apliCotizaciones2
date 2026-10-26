const { errorRef, json } = require('../componentes');
const { MONEDAS_SOPORTADAS, TASAS_BOB, LADOS } = require('../../dominio/monedas');

const ventaCompra = {
  type: 'object',
  properties: { venta: { type: 'number', example: 11.88 }, compra: { type: 'number', example: 11.88 } },
};
const lugar = {
  type: 'object',
  properties: {
    entidad: { type: 'string', example: 'fie' },
    nombre: { type: 'string', example: 'Banco FIE' },
    tipo: { type: 'string', enum: ['referencia', 'exchange', 'billetera', 'banco'] },
    precio: { type: 'number', example: 11.98 },
    diferencia_vs_oficial_pct: { type: 'number', example: 0.84 },
  },
};

module.exports = {
  '/cotizaciones': {
    get: {
      tags: ['Cálculos'],
      summary: 'Resumen: dólar en bolivianos y cada moneda en USD y en bolivianos',
      description: '`en_bob` indica cuántos bolivianos vale **1 unidad** de cada moneda, calculado pasando por el dólar (venta primero, luego compra). `brecha_porcentaje` compara la venta del paralelo con la del oficial.',
      responses: {
        200: json('Resumen', {
          type: 'object',
          properties: {
            base: { type: 'string', example: 'USD' },
            desactualizado: { type: 'boolean' },
            dolar_boliviano: { type: 'object', properties: { oficial: ventaCompra, paralelo: ventaCompra, brecha_porcentaje: { type: 'number', example: 1.01 } } },
            monedas: { type: 'array', items: { type: 'object', properties: {
              codigo: { type: 'string', example: 'EUR' }, nombre: { type: 'string' },
              por_usd: { type: 'number', description: '1 USD = X de esta moneda', example: 0.89145 },
              en_bob: { type: 'object', description: '1 unidad de esta moneda = X bolivianos', properties: { oficial: ventaCompra, paralelo: ventaCompra } },
            } } },
          },
        }, {
          base: 'USD', desactualizado: false,
          dolar_boliviano: { oficial: { venta: 11.88, compra: 11.88 }, paralelo: { venta: 12, compra: 11.96 }, brecha_porcentaje: 1.01 },
          monedas: [{ codigo: 'EUR', nombre: 'Euro', por_usd: 0.89145, en_bob: { oficial: { venta: 13.326, compra: 13.326 }, paralelo: { venta: 13.46, compra: 13.416 } } }],
        }),
        502: json('No se pudieron obtener las fuentes', errorRef),
      },
    },
  },

  '/convertir': {
    get: {
      tags: ['Cálculos'],
      summary: 'Convertir un monto entre monedas',
      description: 'Convierte pasando siempre por el dólar: primero a USD y luego a la moneda destino. Para el boliviano se elige la tasa (`oficial` o `paralelo`) y el lado (`venta` o `compra`). Solo consulta las fuentes que necesita.',
      parameters: [
        { name: 'monto', in: 'query', required: true, description: 'Cantidad a convertir: número ≥ 0 con punto decimal (hasta 12 enteros y 6 decimales)', schema: { type: 'string', pattern: '^\\d{1,12}(\\.\\d{1,6})?$', example: '100' } },
        { name: 'de', in: 'query', required: true, description: 'Moneda de origen', schema: { type: 'string', enum: MONEDAS_SOPORTADAS, example: 'USD' } },
        { name: 'a', in: 'query', required: true, description: 'Moneda de destino', schema: { type: 'string', enum: MONEDAS_SOPORTADAS, example: 'BOB' } },
        { name: 'tasa', in: 'query', required: false, description: 'Tipo de cambio del boliviano', schema: { type: 'string', enum: TASAS_BOB, default: 'oficial' } },
        { name: 'lado', in: 'query', required: false, description: 'Precio de venta o de compra del boliviano', schema: { type: 'string', enum: LADOS, default: 'venta' } },
      ],
      responses: {
        200: json('Resultado de la conversión', {
          type: 'object',
          properties: {
            monto: { type: 'number' }, de: { type: 'string' }, a: { type: 'string' }, tasa: { type: 'string' }, lado: { type: 'string' },
            resultado: { type: 'number' }, desactualizado: { type: 'boolean' },
          },
        }, { monto: 100, de: 'USD', a: 'BOB', tasa: 'oficial', lado: 'venta', resultado: 1188, desactualizado: false }),
        400: json('Parámetro inválido (monto, moneda, tasa o lado)', errorRef, { estado: 'error', mensaje: 'El parámetro "tasa" debe ser: oficial o paralelo' }),
        502: json('No se pudieron obtener las fuentes', errorRef),
      },
    },
  },

  '/comparacion': {
    get: {
      tags: ['Cálculos'],
      summary: 'Dónde conviene comprar y vender dólares',
      description: 'Junta oficial, paralelo, Wallbit y bancos. Para **comprar** dólares conviene la venta más baja; para **vender**, la compra más alta. El oficial se muestra como referencia pero no compite. Los precios desactualizados se excluyen. Si una fuente falla se usan las demás (`fuentes_con_error`).',
      responses: {
        200: json('Comparación', {
          type: 'object',
          properties: {
            base: { type: 'string', example: 'USD' }, cotizada: { type: 'string', example: 'BOB' },
            desactualizado: { type: 'boolean' },
            fuentes_con_error: { type: 'array', items: { type: 'string' }, example: [] },
            referencia_oficial: { type: 'number', nullable: true, example: 11.88 },
            comprar_dolares: { type: 'array', description: 'De menor a mayor venta', items: lugar },
            vender_dolares: { type: 'array', description: 'De mayor a menor compra', items: lugar },
            mejor_para_comprar: { ...lugar, nullable: true },
            mejor_para_vender: { ...lugar, nullable: true },
            excluidas_por_desactualizadas: { type: 'integer', example: 1 },
          },
        }),
        502: json('Ninguna fuente respondió', errorRef),
      },
    },
  },
};
