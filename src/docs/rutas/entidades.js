const { errorRef, cotizacionRef, json, respuestaFuente } = require('../componentes');

const base = { base: { type: 'string', example: 'USD' }, cotizada: { type: 'string', example: 'BOB' } };
const fecha = '2026-10-25';
const hora = '2026-10-26T20:10:00.000Z';

module.exports = {
  '/billeteras': {
    get: {
      tags: ['Entidades'],
      summary: 'Dólar en billeteras digitales y plataformas (Wallbit, Airtm, Takenos, El Dorado y Bitget P2P)',
      description: '`venta` es lo que **pagas** por comprar 1 USD y `compra` lo que **recibes** al vender 1 USD. Una entrada por plataforma (campo `entidad`); si una no responde, las demás se entregan igual y la que falta aparece como `desactualizada` hasta que vuelva. La fuente es dolarbluebolivia.click (tercero, en beta).',
      responses: {
        200: json('Billeteras', respuestaFuente({ ...base, billeteras: { type: 'array', items: cotizacionRef } }), {
          base: 'USD', cotizada: 'BOB', origen: 'dolarbluebolivia', desactualizado: false,
          billeteras: [{ codigo: 'BOB_BILLETERA', nombre: 'Dólar en billeteras', entidad: 'wallbit', entidad_nombre: 'Wallbit', venta: 12.17, compra: 11.82, valor: 12.17, unidad: 'Bs por USD', fecha_fuente: fecha, obtenido_en: hora },
            { codigo: 'BOB_BILLETERA', nombre: 'Dólar en billeteras', entidad: 'airtm', entidad_nombre: 'Airtm', venta: 12.09, compra: 11.58, valor: 12.09, unidad: 'Bs por USD', fecha_fuente: fecha, obtenido_en: hora }],
        }),
        502: json('La fuente no respondió y no hay datos guardados', errorRef),
      },
    },
  },

  '/bancos': {
    get: {
      tags: ['Entidades'],
      summary: 'Dólar en bancos comerciales de Bolivia',
      description: 'Precios de **pizarra** que cada banco publica en su web (pueden diferir de lo que cobra en ventanilla o app). Ordenados de menor a mayor venta; los desactualizados van al final y no cuentan en el resumen.',
      responses: {
        200: json('Bancos', respuestaFuente({
          ...base,
          resumen: {
            type: 'object',
            properties: {
              bancos_con_precio: { type: 'integer', example: 10 },
              mejor_para_comprar: { type: 'object', nullable: true, properties: { entidad: { type: 'string', example: 'fie' }, venta: { type: 'number', example: 11.98 } } },
              mejor_para_vender: { type: 'object', nullable: true, properties: { entidad: { type: 'string', example: 'fortaleza' }, compra: { type: 'number', example: 11.58 } } },
            },
          },
          aviso: { type: 'string' },
          bancos: { type: 'array', items: cotizacionRef },
        }), {
          base: 'USD', cotizada: 'BOB', origen: 'cache', desactualizado: false,
          resumen: { bancos_con_precio: 10, mejor_para_comprar: { entidad: 'fie', venta: 11.98 }, mejor_para_vender: { entidad: 'fortaleza', compra: 11.58 } },
          aviso: 'Precios de pizarra publicados por cada banco en su web; pueden diferir de lo que cobra en ventanilla o app.',
          bancos: [{ codigo: 'BOB_BANCO', nombre: 'Dólar en bancos (pizarra)', entidad: 'fie', entidad_nombre: 'Banco FIE', venta: 11.98, compra: 10.98, valor: 11.98, unidad: 'Bs por USD', fecha_fuente: fecha, obtenido_en: hora }],
        }),
        502: json('La fuente no respondió y no hay datos guardados', errorRef),
      },
    },
  },
};
