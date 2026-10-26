const { errorRef, cotizacionRef, json, ejemploCotizacion, respuestaFuente } = require('../componentes');

const base = { base: { type: 'string', example: 'USD' }, cotizada: { type: 'string', example: 'BOB' } };

module.exports = {
  '/monedas': {
    get: {
      tags: ['Fuentes'],
      summary: 'EUR, CLP, ARS, PEN, BRL y PYG contra el dólar (Frankfurter)',
      description: 'Cuántas unidades de cada moneda equivalen a **1 USD**.',
      responses: {
        200: json('Cotizaciones de las seis monedas', respuestaFuente({
          base: base.base,
          monedas: { type: 'array', items: cotizacionRef },
        }), { base: 'USD', origen: 'cache', desactualizado: false, monedas: [ejemploCotizacion(), ejemploCotizacion({ codigo: 'PYG', nombre: 'Guaraní paraguayo', valor: 5785, fecha_fuente: '2026-10-25' })] }),
        502: json('Frankfurter no respondió y no hay datos guardados', errorRef),
      },
    },
  },

  '/oficial': {
    get: {
      tags: ['Fuentes'],
      summary: 'Tipo de cambio oficial del BCB',
      description: 'Bolivianos por 1 USD, leídos de la portada de bcb.gob.bo (scraping). El BCB publica un solo valor, que se usa como venta y como compra. `fecha_fuente` es el último día de vigencia publicado.',
      responses: {
        200: json('Tipo de cambio oficial', respuestaFuente({ ...base, oficial: cotizacionRef }), {
          base: 'USD', cotizada: 'BOB', origen: 'bcb', desactualizado: false,
          oficial: { codigo: 'BOB_OFICIAL', nombre: 'Dólar oficial (BCB)', entidad: 'bcb', entidad_nombre: 'Banco Central de Bolivia', venta: 11.88, compra: 11.88, valor: 11.88, unidad: 'Bs por USD', fecha_fuente: '2026-10-26', obtenido_en: '2026-10-26T20:10:00.000Z' },
        }),
        502: json('El BCB no respondió o cambió de formato, y no hay datos guardados', errorRef),
      },
    },
  },

  '/paralelo': {
    get: {
      tags: ['Fuentes'],
      summary: 'Dólar paralelo en bolivianos',
      description: 'Mediana de los mejores anuncios P2P de **Binance** (USDT/BOB; 1 USDT ≈ 1 USD). Si Binance falla se usa la lectura agregada de dolarbluebolivia.click y `origen` lo indica. La fuente de Binance no es oficial.',
      responses: {
        200: json('Dólar paralelo', respuestaFuente({ ...base, origen: { type: 'string', enum: ['binance', 'dolarbluebolivia', 'cache'] }, paralelo: cotizacionRef }), {
          base: 'USD', cotizada: 'BOB', origen: 'binance', desactualizado: false,
          paralelo: { codigo: 'BOB_PARALELO', nombre: 'Dólar paralelo (Binance)', entidad: 'binance', venta: 12, compra: 11.96, valor: 12, unidad: 'Bs por USD', fecha_fuente: '2026-10-25', obtenido_en: '2026-10-26T20:10:00.000Z' },
        }),
        502: json('Ninguna fuente respondió y no hay datos guardados', errorRef),
      },
    },
  },

  '/indicadores': {
    get: {
      tags: ['Fuentes'],
      summary: 'Oro, UFV e inflación (BCB)',
      description: 'Leídos de la portada del BCB. Si un indicador cambia de formato, los demás se entregan igual y el faltante aparece como `null`.',
      responses: {
        200: json('Indicadores', respuestaFuente({
          oro: { ...cotizacionRef, nullable: true },
          ufv: { ...cotizacionRef, nullable: true },
          inflacion: { type: 'object', properties: { mensual: cotizacionRef, doce_meses: cotizacionRef } },
        }), {
          origen: 'bcb', desactualizado: false,
          oro: { codigo: 'ORO', nombre: 'Oro', entidad: 'bcb', valor: 3992.83, unidad: 'USD por onza troy', fecha_fuente: '2026-10-26', obtenido_en: '2026-10-26T20:10:00.000Z' },
          ufv: { codigo: 'UFV', nombre: 'Unidad de Fomento a la Vivienda', entidad: 'bcb', valor: 3.36331, unidad: 'Bs por UFV', fecha_fuente: '2026-10-26', obtenido_en: '2026-10-26T20:10:00.000Z' },
          inflacion: {
            mensual: { codigo: 'INFLACION_MENSUAL', valor: 0.85, unidad: '%', fecha_fuente: '2026-09-30' },
            doce_meses: { codigo: 'INFLACION_12M', valor: 5.7, unidad: '%', fecha_fuente: '2026-09-30' },
          },
        }),
        502: json('El BCB no respondió y no hay datos guardados', errorRef),
      },
    },
  },
};
