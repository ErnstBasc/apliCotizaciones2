// Consultas de solo lectura para el panel del administrador, más la escritura de los contadores de uso.
// Solo SQL parametrizado. Todo lo que devuelve son TOTALES: nunca correos ni datos de una persona concreta.
const FECHA = (columna) => `to_char((${columna} AT TIME ZONE 'UTC' - INTERVAL '4 hours')::date, 'YYYY-MM-DD')`; // día en hora de Bolivia (UTC-4)
const n = (x) => Number(x ?? 0); // pg entrega los COUNT/SUM (bigint) como texto

function crearRepositorioEstadisticas(db) {
  const filas = async (sql, params = []) => (await db.query(sql, params)).rows;

  return {
    // Suma `total` al contador del día/tipo/ruta (lo crea si no existe). Una sola sentencia: sin carreras.
    sumarUso: ({ dia, tipo, ruta, total }) => db.query(
      `INSERT INTO uso_diario (dia, tipo, ruta, total) VALUES ($1, $2, $3, $4)
       ON CONFLICT (dia, tipo, ruta) DO UPDATE SET total = uso_diario.total + EXCLUDED.total`,
      [dia, tipo, ruta, total]),

    async usuarios() {
      const [f] = await filas(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE verificado_en IS NOT NULL) AS verificados,
                COUNT(*) FILTER (WHERE rol = 'registrado') AS registrado,
                COUNT(*) FILTER (WHERE rol = 'premium')    AS premium,
                COUNT(*) FILTER (WHERE rol = 'admin')      AS admin
           FROM usuarios`);
      return { total: n(f.total), verificados: n(f.verificados), porRol: { registrado: n(f.registrado), premium: n(f.premium), admin: n(f.admin) } };
    },
    async altasPorDia(desde) {
      return (await filas(
        `SELECT ${FECHA('creado_en')} AS fecha, COUNT(*) AS total FROM usuarios
          WHERE ${FECHA('creado_en')} >= $1 GROUP BY 1 ORDER BY 1`, [desde])).map((f) => ({ fecha: f.fecha, total: n(f.total) }));
    },

    async alertas() {
      const [f] = await filas('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE activa) AS activas FROM alertas');
      return { total: n(f.total), activas: n(f.activas) };
    },
    async avisos(desde) {
      const [f] = await filas(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE ${FECHA('enviado_en')} >= $1) AS en_periodo FROM avisos_enviados`, [desde]);
      return { total: n(f.total), enPeriodo: n(f.en_periodo) };
    },

    async usoPorDia(desde) {
      return (await filas(
        `SELECT to_char(dia, 'YYYY-MM-DD') AS fecha, tipo, SUM(total) AS total FROM uso_diario
          WHERE dia >= $1::date GROUP BY dia, tipo ORDER BY dia`, [desde])).map((f) => ({ fecha: f.fecha, tipo: f.tipo, total: n(f.total) }));
    },
    async usoPorRuta(desde, limite = 10) {
      return (await filas(
        `SELECT ruta, SUM(total) AS total FROM uso_diario
          WHERE tipo = 'peticion' AND dia >= $1::date GROUP BY ruta ORDER BY SUM(total) DESC, ruta LIMIT $2`, [desde, limite]))
        .map((f) => ({ ruta: f.ruta, total: n(f.total) }));
    },
    async primerDiaDeUso() {
      const [f] = await filas(`SELECT to_char(MIN(dia), 'YYYY-MM-DD') AS dia FROM uso_diario`);
      return f.dia || null;
    },

    async datos() {
      const [t] = await filas('SELECT COUNT(*) AS total, MAX(obtenido_en) AS ultima FROM cotizaciones');
      const porFuente = await filas(
        `SELECT f.nombre AS fuente, COUNT(*) AS total FROM cotizaciones c JOIN fuentes f ON f.id = c.fuente_id GROUP BY f.nombre ORDER BY COUNT(*) DESC`);
      return { cotizaciones: n(t.total), ultimaObtencion: t.ultima ? new Date(t.ultima).toISOString() : null, porFuente: porFuente.map((f) => ({ fuente: f.fuente, total: n(f.total) })) };
    },
  };
}

module.exports = { crearRepositorioEstadisticas };
