// Rellena el histórico con datos REALES de las series públicas de dolarbluebolivia.click.
//   npm run datos:importar -- --explorar   → solo muestra qué trae la API (no toca la base)
//   npm run datos:importar -- --simular    → calcula qué guardaría, sin guardar nada
//   npm run datos:importar                 → guarda (se puede repetir: solo agrega los días que faltan)
//   npm run datos:importar -- --borrar     → borra TODO lo importado (fuente "dolarblue_historico")
// Lo importado lleva su propia fuente: se distingue de lo que guarda el recolector y se borra sin tocar nada más.
require('dotenv').config();
const { cargarConfig } = require('../src/config');
const { crearPool } = require('../src/repositories/pool');
const { crearClienteDolarblue, BASE } = require('../src/adapters/dolarbluebolivia/cliente');
const { FUENTE_IMPORTADA, RUTAS, extraerPuntos, convertir, planificar } = require('../src/services/importadorHistorico');
const { SERIES } = require('../src/dominio/historico');

const opciones = new Set(process.argv.slice(2));
const SQL_FUENTE = `INSERT INTO fuentes (codigo, nombre, url)
  VALUES ($1, 'dolarbluebolivia.click (histórico importado)', 'https://dolarbluebolivia.click') ON CONFLICT (codigo) DO NOTHING`;
const SQL_FICTICIOS = `SELECT COUNT(*) AS n FROM cotizaciones WHERE fuente_id = (SELECT id FROM fuentes WHERE codigo = 'simulado')`;
const SQL_OCUPADOS = `
  SELECT DISTINCT to_char(((c.obtenido_en AT TIME ZONE 'UTC') - INTERVAL '4 hours')::date, 'YYYY-MM-DD') AS dia
    FROM cotizaciones c
    JOIN instrumentos i ON i.id = c.instrumento_id
    JOIN entidades    e ON e.id = c.entidad_id
   WHERE i.codigo = $1 AND e.codigo = $2 AND c.estado = 'vigente'`;
const SQL_INSERTAR = `
  INSERT INTO cotizaciones (instrumento_id, entidad_id, fuente_id, valor, compra, venta, estado, fecha_fuente, obtenido_en)
  VALUES ((SELECT id FROM instrumentos WHERE codigo = $1), (SELECT id FROM entidades WHERE codigo = $2),
          (SELECT id FROM fuentes WHERE codigo = $3), $4, $5, $6, 'vigente', $7, $8)`;
const SQL_BORRAR = 'DELETE FROM cotizaciones WHERE fuente_id = (SELECT id FROM fuentes WHERE codigo = $1)';

async function explorar(cliente) {
  for (const [serie, ruta] of Object.entries(RUTAS)) {
    console.log(`\n=== ${serie}: ${BASE}${ruta}`);
    const json = await cliente.obtenerJson(ruta);
    const puntos = extraerPuntos(json);
    console.log(`Puntos: ${puntos.length}`);
    console.log('Primero:', JSON.stringify(puntos[0]));
    console.log('Último: ', JSON.stringify(puntos.at(-1)));
    const { lecturas, descartados } = convertir(serie, json);
    console.log(`Interpretadas: ${lecturas.length}, descartadas: ${descartados}`);
    if (lecturas.length) console.log(`Desde ${lecturas[0].dia} hasta ${lecturas.at(-1).dia}. Última: venta ${lecturas.at(-1).venta} · compra ${lecturas.at(-1).compra}`);
  }
}

async function main() {
  const cliente = crearClienteDolarblue({ timeoutMs: 20_000 });
  if (opciones.has('--explorar')) return explorar(cliente);

  const pool = crearPool(cargarConfig().db);
  const db = await pool.connect();
  try {
    if (opciones.has('--borrar')) {
      const r = await db.query(SQL_BORRAR, [FUENTE_IMPORTADA]);
      console.log(`Borradas ${r.rowCount} filas importadas. Lo guardado por el recolector no se tocó.`);
      return;
    }
    const ficticios = Number((await db.query(SQL_FICTICIOS)).rows[0].n);
    if (ficticios > 0) {
      throw new Error(`Hay ${ficticios} filas de datos ficticios: ocuparían los días y no se importaría nada.\n` +
        'Bórralos primero con: npm run datos:borrar-ficticios');
    }
    const simular = opciones.has('--simular');
    await db.query('BEGIN');
    await db.query(SQL_FUENTE, [FUENTE_IMPORTADA]);
    let total = 0;
    for (const [serie, ruta] of Object.entries(RUTAS)) {
      const { lecturas, descartados } = convertir(serie, await cliente.obtenerJson(ruta));
      const { instrumento, entidad } = SERIES[serie];
      const diasOcupados = (await db.query(SQL_OCUPADOS, [instrumento, entidad])).rows.map((f) => f.dia);
      const plan = planificar({ serie, lecturas, diasOcupados });
      console.log(`${serie}: ${plan.dias} días en la fuente (${descartados} puntos descartados), ${plan.yaExistian} ya tenían datos, ` +
        `${plan.filas.length} nuevos${plan.desde ? ` (del ${plan.desde} al ${plan.hasta})` : ''}.`);
      if (!simular) {
        for (const f of plan.filas) {
          await db.query(SQL_INSERTAR, [f.instrumento, f.entidad, FUENTE_IMPORTADA, f.valor, f.compra, f.venta, f.fecha, f.obtenidoEn]);
        }
      }
      total += plan.filas.length;
    }
    if (simular) { await db.query('ROLLBACK'); console.log(`\nSimulación: se guardarían ${total} filas. No se guardó nada.`); }
    else { await db.query('COMMIT'); console.log(`\nListo: ${total} filas guardadas con la fuente "${FUENTE_IMPORTADA}".`); }
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(`\nNo se pudo: ${err.message}`); process.exit(1); });
