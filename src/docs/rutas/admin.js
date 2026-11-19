const { errorRef, json } = require('../componentes');
const { DIAS_ESTADISTICAS } = require('../../routes/validacion');

const protegida = [{ sesion: [] }];
const serieDia = (campos) => ({ type: 'array', items: { type: 'object', properties: { fecha: { type: 'string', example: '2026-11-19' }, ...campos } } });
const entero = (ejemplo) => ({ type: 'integer', example: ejemplo });

const esquemaEstadisticas = {
  type: 'object',
  properties: {
    generadoEn: { type: 'string', format: 'date-time' },
    periodo: { type: 'object', properties: { dias: entero(30), desde: { type: 'string', example: '2026-10-21' }, hasta: { type: 'string', example: '2026-11-19' } } },
    usuarios: { type: 'object', properties: {
      total: entero(42), verificados: entero(37), altasEnPeriodo: entero(9),
      porRol: { type: 'object', properties: { registrado: entero(41), premium: entero(0), admin: entero(1) } },
      altasPorDia: serieDia({ total: entero(2) }) } },
    alertas: { type: 'object', properties: { total: entero(15), activas: entero(12), avisosEnviados: entero(31), avisosEnPeriodo: entero(8) } },
    uso: { type: 'object', description: 'Peticiones a la API y descargas de CSV (las descargas están incluidas en las peticiones). Sin /admin ni /health.', properties: {
      medidoDesde: { type: 'string', nullable: true, description: 'Primer día con contadores. Antes de esa fecha los ceros significan "sin medir", no "sin uso".', example: '2026-11-19' },
      peticiones: entero(1830), descargas: entero(12),
      porDia: serieDia({ peticiones: entero(60), descargas: entero(1) }),
      rutas: { type: 'array', description: 'Las rutas más pedidas del período', items: { type: 'object', properties: { ruta: { type: 'string', example: '/cotizaciones' }, total: entero(700) } } } } },
    datos: { type: 'object', properties: {
      cotizaciones: entero(25400), ultimaObtencion: { type: 'string', format: 'date-time', nullable: true },
      porFuente: { type: 'array', items: { type: 'object', properties: { fuente: { type: 'string', example: 'Binance P2P (no oficial)' }, total: entero(9000) } } } } },
  },
};

module.exports = {
  '/admin/estadisticas': { get: {
    tags: ['Administración'], summary: 'Estadísticas de uso', security: protegida,
    description: 'Totales de usuarios, alertas, uso de la API y datos guardados. **Solo para administradores** (sesión + rol `admin`). ' +
      'Entrega únicamente totales: ningún correo ni dato de una persona concreta. Las cuentas de administrador se crean solo con el script `npm run admin:crear`.',
    parameters: [{ name: 'dias', in: 'query', required: false, schema: { type: 'integer', enum: DIAS_ESTADISTICAS, default: 30 }, description: 'Período en días, contando hoy' }],
    responses: {
      200: json('Resumen del período', esquemaEstadisticas),
      400: json('Parámetro inválido', errorRef),
      401: json('No hay sesión iniciada', errorRef),
      403: json('La cuenta no es de administrador, o el origen no está permitido', errorRef),
    },
  } },
};
