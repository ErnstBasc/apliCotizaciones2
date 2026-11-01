const { errorRef, json } = require('../componentes');
const { SELECCIONES, DIAS_PERMITIDOS, FORMATOS_CSV } = require('../../dominio/historico');

const punto = {
  type: 'object',
  properties: {
    fecha: { type: 'string', example: '2026-10-30' },
    venta: { type: 'number', description: 'Lo que PAGAS por comprar 1 USD', example: 11.97 },
    compra: { type: 'number', description: 'Lo que RECIBES al vender 1 USD', example: 11.92 },
  },
};

const parametros = [
  { name: 'serie', in: 'query', required: false, schema: { type: 'string', enum: SELECCIONES, default: 'ambos' }, description: 'Qué dólar incluir' },
  { name: 'dias', in: 'query', required: false, schema: { type: 'integer', enum: DIAS_PERMITIDOS, default: 30 }, description: 'Cuántos días hacia atrás: 7, 30, 90 o 180' },
];

module.exports = {
  '/historico.csv': {
    get: {
      tags: ['Histórico'], summary: 'Descargar el histórico en CSV', security: [{ sesion: [] }],
      description: 'Los mismos datos del gráfico, una fila por día. **Requiere sesión iniciada y correo confirmado.** ' +
        'Columnas: `fecha`, `oficial_bs_por_usd`, `paralelo_venta_bs_por_usd`, `paralelo_compra_bs_por_usd` (solo las de la serie pedida; una celda vacía = ese día no hay dato). ' +
        'Formato `excel` (por defecto): separador `;`, decimales con coma y UTF-8 con BOM, para abrirlo con doble clic en Excel en español. Formato `estandar`: separador `,` y decimales con punto.',
      parameters: [...parametros, { name: 'formato', in: 'query', required: false, schema: { type: 'string', enum: FORMATOS_CSV, default: 'excel' } }],
      responses: {
        200: { description: 'Archivo CSV (se descarga con Content-Disposition: attachment)', content: { 'text/csv': { schema: { type: 'string' }, example: 'fecha;oficial_bs_por_usd;paralelo_venta_bs_por_usd;paralelo_compra_bs_por_usd\r\n2026-10-30;12,09;11,97;11,92\r\n' } } },
        400: json('Parámetro inválido', errorRef),
        401: json('No hay sesión iniciada', errorRef),
        403: json('Correo sin confirmar', errorRef),
      },
    },
  },
  '/historico': {
    get: {
      tags: ['Histórico'],
      summary: 'Evolución diaria del dólar oficial y/o paralelo',
      description: 'Devuelve el **último valor de cada día** (hora de Bolivia) de los últimos `dias` días, contando hoy. Los días sin datos no aparecen. Los datos los acumula el recolector (`npm run recolector`) y también cada consulta de las demás rutas.',
      parameters: parametros,
      responses: {
        200: json('Serie diaria', {
          type: 'object',
          properties: {
            base: { type: 'string', example: 'USD' },
            cotizada: { type: 'string', example: 'BOB' },
            serie: { type: 'string', enum: SELECCIONES },
            dias: { type: 'integer', example: 30 },
            desde: { type: 'string', example: '2026-10-02' },
            hasta: { type: 'string', example: '2026-10-31' },
            series: { type: 'object', properties: { oficial: { type: 'array', items: punto }, paralelo: { type: 'array', items: punto } } },
            nota: { type: 'string' },
          },
        }, {
          base: 'USD', cotizada: 'BOB', serie: 'ambos', dias: 30, desde: '2026-10-02', hasta: '2026-10-31',
          series: {
            oficial: [{ fecha: '2026-10-29', venta: 12.09, compra: 12.09 }, { fecha: '2026-10-30', venta: 12.09, compra: 12.09 }],
            paralelo: [{ fecha: '2026-10-29', venta: 11.95, compra: 11.9 }, { fecha: '2026-10-30', venta: 11.97, compra: 11.92 }],
          },
          nota: 'Último valor de cada día (hora de Bolivia). Los días sin datos no aparecen.',
        }),
        400: json('Parámetro inválido', errorRef),
      },
    },
  },
};
