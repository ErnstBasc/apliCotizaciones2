const { errorRef, json } = require('../componentes');

const resumenArticulo = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    titulo: { type: 'string', example: 'Perspectivas del tipo de cambio' },
    autor: { type: 'string', example: 'Autor de prueba' },
    resumen: { type: 'string', example: 'Resumen público del artículo.' },
    publicadoEn: { type: 'string', format: 'date-time' },
  },
};

module.exports = {
  '/articulos': { get: {
    tags: ['Artículos'], summary: 'Artículos de análisis (títulos y resúmenes)',
    description: 'Público. Nunca incluye el texto completo: ese es solo para usuarios premium (ver /articulos/{id}).',
    responses: {
      200: json('Lista, del más reciente al más antiguo', {
        type: 'object',
        properties: {
          articulos: { type: 'array', items: resumenArticulo },
          lectores: { type: 'array', items: { type: 'string' }, example: ['premium', 'admin'], description: 'Roles que pueden leer el texto completo' },
        },
      }),
    },
  } },
  '/articulos/{id}': { get: {
    tags: ['Artículos'], summary: 'Leer un artículo completo (premium)', security: [{ sesion: [] }],
    description: 'Exige sesión con rol **premium** (o admin). Un usuario común recibe 403. El rol premium se asigna con `npm run usuario:rol -- correo premium`. El texto es plano (no HTML), dividido en párrafos.',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    responses: {
      200: json('El artículo completo', {
        type: 'object',
        properties: { articulo: { allOf: [resumenArticulo, { type: 'object', properties: { parrafos: { type: 'array', items: { type: 'string' } } } }] } },
      }),
      400: json('Identificador inválido', errorRef),
      401: json('No hay sesión iniciada', errorRef),
      403: json('La cuenta no es premium', errorRef),
      404: json('El artículo no existe', errorRef),
    },
  } },
};
