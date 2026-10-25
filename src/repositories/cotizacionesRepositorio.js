// Repositorio: ÚNICO lugar que conoce el SQL de las cotizaciones.
// Recibe "db" (cualquier objeto con query(sql, params), como un Pool de pg) desde afuera,
// así los servicios no saben qué base hay detrás y las pruebas pueden usar una falsa.
//
// Seguridad: todas las consultas son parametrizadas ($1, $2…); nunca se concatenan datos en el SQL.

const SQL_INSERTAR = `
  INSERT INTO cotizaciones (instrumento_id, entidad_id, fuente_id, valor, compra, venta, estado, fecha_fuente)
  VALUES (
    (SELECT id FROM instrumentos WHERE codigo = $1),
    (SELECT id FROM entidades    WHERE codigo = $2),
    (SELECT id FROM fuentes      WHERE codigo = $3),
    $4, $5, $6, $7, $8
  )`;

// Última fila de cada pareja (instrumento, entidad) con DISTINCT ON.
const SQL_ULTIMAS = `
  SELECT DISTINCT ON (c.instrumento_id, c.entidad_id)
         i.codigo AS instrumento, e.codigo AS entidad, i.unidad,
         c.valor, c.compra, c.venta, c.estado,
         to_char(c.fecha_fuente, 'YYYY-MM-DD') AS fecha,
         c.obtenido_en
    FROM cotizaciones c
    JOIN instrumentos i ON i.id = c.instrumento_id
    LEFT JOIN entidades e ON e.id = c.entidad_id
   WHERE i.codigo = ANY($1)
   ORDER BY c.instrumento_id, c.entidad_id, c.obtenido_en DESC`;

// pg devuelve NUMERIC como texto para no perder precisión; nuestros cálculos usan Number.
const aNumero = (x) => (x === null || x === undefined ? null : Number(x));

function filaAObservacion(f) {
  return {
    instrumento: f.instrumento,
    entidad: f.entidad,
    valor: aNumero(f.valor),
    compra: aNumero(f.compra),
    venta: aNumero(f.venta),
    unidad: f.unidad,
    fecha: f.fecha,
    estado: f.estado,
    obtenidoEn: f.obtenido_en instanceof Date ? f.obtenido_en : new Date(f.obtenido_en),
  };
}

function crearRepositorioCotizaciones(db) {
  return {
    // Guarda una Observacion (ver contracts/observacion.js) indicando de qué fuente vino.
    async guardar(obs, fuente) {
      const r = await db.query(SQL_INSERTAR, [
        obs.instrumento, obs.entidad, fuente, obs.valor, obs.compra, obs.venta, obs.estado, obs.fecha,
      ]);
      return r.rowCount;
    },

    async guardarVarias(observaciones, fuente) {
      for (const o of observaciones) await this.guardar(o, fuente);
      return observaciones.length;
    },

    // Últimas observaciones de los instrumentos pedidos (una por entidad).
    async ultimas(codigosInstrumento) {
      const r = await db.query(SQL_ULTIMAS, [codigosInstrumento]);
      return r.rows.map(filaAObservacion);
    },

    // Para /health: cuántos instrumentos hay (también prueba que la base responde).
    async contarInstrumentos() {
      const r = await db.query('SELECT COUNT(*)::int AS n FROM instrumentos');
      return r.rows[0].n;
    },
  };
}

module.exports = { crearRepositorioCotizaciones, filaAObservacion };
