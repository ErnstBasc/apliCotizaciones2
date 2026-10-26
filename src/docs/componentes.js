// Piezas reutilizables de la especificación OpenAPI (esquemas y atajos).
const errorRef = { $ref: '#/components/schemas/Error' };
const cotizacionRef = { $ref: '#/components/schemas/Cotizacion' };

// Atajo: respuesta JSON con descripción, esquema y (opcional) ejemplo
const json = (descripcion, schema, example) => ({
  description: descripcion,
  content: { 'application/json': { schema, ...(example ? { example } : {}) } },
});

const esquemas = {
  Cotizacion: {
    type: 'object',
    description: 'Última cotización guardada de un instrumento. Las claves vacías (null) se omiten.',
    properties: {
      codigo: { type: 'string', example: 'BOB_BANCO' },
      nombre: { type: 'string', example: 'Dólar en bancos (pizarra)' },
      entidad: { type: 'string', description: 'Código de quién cotiza (banco, billetera…)', example: 'fie' },
      entidad_nombre: { type: 'string', example: 'Banco FIE' },
      venta: { type: 'number', description: 'Lo que PAGAS por comprar 1 USD', example: 11.98 },
      compra: { type: 'number', description: 'Lo que RECIBES al vender 1 USD', example: 10.98 },
      valor: { type: 'number', description: 'Valor de referencia (en tipos de cambio coincide con la venta)', example: 11.98 },
      unidad: { type: 'string', example: 'Bs por USD' },
      fecha_fuente: { type: 'string', nullable: true, description: 'Fecha (AAAA-MM-DD) que declara la fuente', example: '2026-10-25' },
      obtenido_en: { type: 'string', format: 'date-time', description: 'Cuándo la consultó apliCotizaciones2' },
      estado: { type: 'string', enum: ['desactualizado'], description: 'Solo aparece si el precio está desactualizado' },
    },
  },
  Error: {
    type: 'object',
    properties: {
      estado: { type: 'string', example: 'error' },
      mensaje: { type: 'string', example: 'Ruta no encontrada' },
    },
  },
};

const ejemploCotizacion = (extra) => ({
  codigo: 'EUR', nombre: 'Euro', valor: 0.89145, unidad: 'por USD', fecha_fuente: '2026-10-26',
  obtenido_en: '2026-10-26T20:10:00.000Z', ...extra,
});

const respuestaFuente = (extra = {}) => ({
  type: 'object',
  properties: {
    origen: { type: 'string', description: 'Fuente que respondió, o "cache" si se sirvió desde la base', example: 'cache' },
    desactualizado: { type: 'boolean', description: 'true si la fuente falló y se devolvió el último valor guardado' },
    ...extra,
  },
});

module.exports = { errorRef, cotizacionRef, json, esquemas, ejemploCotizacion, respuestaFuente };
