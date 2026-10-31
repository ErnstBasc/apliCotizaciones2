// Llena la base con series FICTICIAS del oficial y el paralelo para probar el histórico y el gráfico.
//   npm run datos:ficticios                 → genera 180 días (se puede repetir: reemplaza los anteriores)
//   npm run datos:ficticios -- --dias 90    → otra cantidad de días
//   npm run datos:borrar-ficticios          → borra TODOS los datos ficticios y deja los reales
// Todo lo ficticio se guarda con la fuente "simulado", así que se distingue y se borra sin tocar nada más.
require('dotenv').config();
const { cargarConfig } = require('../src/config');
const { crearPool } = require('../src/repositories/pool');
const { generarSeries } = require('./generarSeries');

const config = cargarConfig();
const argumentos = process.argv.slice(2);
const soloBorrar = argumentos.includes('--borrar');
const posDias = argumentos.indexOf('--dias');
const dias = posDias >= 0 ? Number(argumentos[posDias + 1]) : 180;

const SQL_BORRAR = 'DELETE FROM cotizaciones WHERE fuente_id = (SELECT id FROM fuentes WHERE codigo = $1)';
const SQL_FUENTE = `INSERT INTO fuentes (codigo, nombre, url) VALUES ('simulado', 'Datos ficticios (solo pruebas)', NULL) ON CONFLICT (codigo) DO NOTHING`;
const SQL_INSERTAR = `
  INSERT INTO cotizaciones (instrumento_id, entidad_id, fuente_id, valor, compra, venta, estado, fecha_fuente, obtenido_en)
  VALUES (
    (SELECT id FROM instrumentos WHERE codigo = $1),
    (SELECT id FROM entidades    WHERE codigo = $2),
    (SELECT id FROM fuentes      WHERE codigo = 'simulado'),
    $3, $4, $5, 'vigente', $6, $7)`;

async function main() {
  if (config.entorno === 'production') throw new Error('No se siembran datos ficticios en producción.');
  const pool = crearPool(config.db);
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(SQL_FUENTE);
    const borradas = await cliente.query(SQL_BORRAR, ['simulado']);
    console.log(`Datos ficticios anteriores borrados: ${borradas.rowCount}`);
    if (!soloBorrar) {
      const filas = generarSeries({ dias });
      for (const f of filas) {
        await cliente.query(SQL_INSERTAR, [f.instrumento, f.entidad, f.valor, f.compra, f.venta, f.fecha, f.obtenidoEn]);
      }
      console.log(`Datos ficticios guardados: ${filas.length} filas (${dias} días, hasta ayer). Fuente: "simulado".`);
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
    await pool.end();
  }
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
