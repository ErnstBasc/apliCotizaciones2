const { errorRef, json } = require('../componentes');
const { SERIES_ALERTA, LADOS, TIPOS, LIMITES_UMBRAL } = require('../../dominio/alertas');

const alertaRef = { $ref: '#/components/schemas/Alerta' };
const protegida = [{ sesion: [] }];
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Identificador de la alerta' };
const ejemplo = { id: 5, serie: 'paralelo', lado: 'venta', tipo: 'sube_de', umbral: 12.5, activa: true, descripcion: 'El dólar paralelo (venta) sube de 12,50 Bs', ultimoAviso: null, creadaEn: '2026-11-01T16:00:00.000Z' };
const r401 = json('No hay sesión iniciada', errorRef);
const r403 = json('Correo sin confirmar u origen no permitido', errorRef);
const r404 = json('Alerta inexistente (o de otro usuario)', errorRef);

module.exports = {
  '/alertas': {
    get: {
      tags: ['Alertas'], summary: 'Mis alertas', security: protegida,
      description: 'Lista las alertas del usuario y los límites vigentes. **Requiere sesión y correo confirmado.**',
      responses: {
        200: json('Alertas del usuario', { type: 'object', properties: { maximo: { type: 'integer', example: 3 }, enfriamientoHoras: { type: 'number', example: 12 }, alertas: { type: 'array', items: alertaRef } } },
          { maximo: 3, enfriamientoHoras: 12, alertas: [ejemplo] }),
        401: r401, 403: r403,
      },
    },
    post: {
      tags: ['Alertas'], summary: 'Crear una alerta', security: protegida,
      description: 'Tipos: `sube_de` (avisa cuando el precio llega o pasa del umbral), `baja_de` (cuando llega o baja del umbral) y `cambio_pct` (cuando el precio cambió, hacia arriba o hacia abajo, al menos ese porcentaje respecto al cierre del día anterior). ' +
        `El umbral va en Bs (${LIMITES_UMBRAL.precio.min} a ${LIMITES_UMBRAL.precio.max}) o en % (${LIMITES_UMBRAL.porcentaje.min} a ${LIMITES_UMBRAL.porcentaje.max}). ` +
        'El oficial tiene un solo valor, así que `lado` se ignora. Hay un máximo de alertas por usuario (409 al superarlo). Los avisos llegan por correo, y una misma alerta no repite aviso antes del tiempo de espera.',
      requestBody: { required: true, content: { 'application/json': {
        schema: { type: 'object', required: ['serie', 'tipo', 'umbral'], properties: {
          serie: { type: 'string', enum: SERIES_ALERTA }, lado: { type: 'string', enum: LADOS, default: 'venta' },
          tipo: { type: 'string', enum: TIPOS }, umbral: { type: 'number', example: 12.5 } } },
        example: { serie: 'paralelo', lado: 'venta', tipo: 'sube_de', umbral: 12.5 } } } },
      responses: { 200: json('Alerta creada', { type: 'object', properties: { alerta: alertaRef } }, { alerta: ejemplo }), 400: json('Datos inválidos', errorRef), 401: r401, 403: r403, 409: json('Se alcanzó el máximo de alertas', errorRef) },
    },
  },
  '/alertas/{id}': {
    patch: {
      tags: ['Alertas'], summary: 'Pausar o reanudar una alerta', security: protegida, parameters: [idParam],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['activa'], properties: { activa: { type: 'boolean' } } }, example: { activa: false } } } },
      responses: { 200: json('Alerta actualizada', { type: 'object', properties: { alerta: alertaRef } }, { alerta: { ...ejemplo, activa: false } }), 400: json('Datos inválidos', errorRef), 401: r401, 403: r403, 404: r404 },
    },
    delete: {
      tags: ['Alertas'], summary: 'Eliminar una alerta', security: protegida, parameters: [idParam],
      responses: { 200: json('Alerta eliminada', { $ref: '#/components/schemas/Mensaje' }, { mensaje: 'Alerta eliminada' }), 400: json('Identificador inválido', errorRef), 401: r401, 403: r403, 404: r404 },
    },
  },
};
