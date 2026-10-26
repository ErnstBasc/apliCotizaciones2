// Ensambla la especificación OpenAPI a partir de módulos pequeños (uno por grupo de rutas).
// Agregar una ruta nueva = editar solo su módulo en docs/rutas/.
const { esquemas } = require('./componentes');

const especificacion = {
  openapi: '3.0.3',
  info: {
    title: 'apliCotizaciones2',
    version: '2.0.0',
    description:
      'Backend (Express + PostgreSQL) con tipos de cambio y cotizaciones para Bolivia: dólar oficial (BCB), paralelo (Binance P2P), ' +
      'monedas vecinas y el euro, oro, UFV, inflación, billeteras y bancos.\n\n' +
      '**Convenciones:** todo se expresa como "1 USD = X". En el dólar a boliviano se muestra primero la **venta** (lo que pagas) y luego la **compra** (lo que recibes). ' +
      'Cada fuente tiene un caché en PostgreSQL; si una fuente falla se devuelve el último valor guardado con `desactualizado: true`.',
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  tags: [
    { name: 'Estado', description: 'Verificación del servicio' },
    { name: 'Fuentes', description: 'Cada fuente por separado, con su caché' },
    { name: 'Entidades', description: 'Dólar en billeteras y bancos' },
    { name: 'Cálculos', description: 'Resumen, conversión y comparación calculados a partir de las fuentes' },
  ],
  paths: {
    ...require('./rutas/estado'),
    ...require('./rutas/fuentes'),
    ...require('./rutas/entidades'),
    ...require('./rutas/calculos'),
  },
  components: { schemas: esquemas },
};

module.exports = especificacion;
