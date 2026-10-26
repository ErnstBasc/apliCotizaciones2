const { errorRef, json } = require('../componentes');

module.exports = {
  '/health': {
    get: {
      tags: ['Estado'],
      summary: 'Estado del servicio y de la base de datos',
      responses: {
        200: json('Servicio y base de datos funcionando', {
          type: 'object',
          properties: {
            estado: { type: 'string', example: 'ok' },
            base_de_datos: { type: 'string', example: 'conectada' },
            instrumentos: { type: 'integer', example: 14 },
          },
        }, { estado: 'ok', base_de_datos: 'conectada', instrumentos: 14 }),
        503: json('La base de datos no está disponible', errorRef),
      },
    },
  },
};
