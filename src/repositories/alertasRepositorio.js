// Acceso a datos de alertas. SQL parametrizado; cada operación sobre una alerta exige también el usuario dueño
// (así nadie puede tocar alertas ajenas aunque adivine un id).
const COLUMNAS = 'id, usuario_id, serie, lado, tipo, umbral, activa, ultimo_aviso_en, creada_en';
const aFecha = (v) => (v ? new Date(v) : null);

const aAlerta = (f) => f && {
  id: Number(f.id), usuarioId: Number(f.usuario_id), serie: f.serie, lado: f.lado, tipo: f.tipo,
  umbral: Number(f.umbral), activa: f.activa, ultimoAvisoEn: aFecha(f.ultimo_aviso_en), creadaEn: aFecha(f.creada_en),
};

function crearRepositorioAlertas(db) {
  return {
    // Crea la alerta solo si el usuario tiene menos de `maximo`. Devuelve null si ya llegó al tope.
    // (Un tope blando: dos peticiones exactamente simultáneas podrían pasar una de más; no es un problema de seguridad.)
    async crear({ usuarioId, serie, lado, tipo, umbral, maximo }) {
      const r = await db.query(
        `INSERT INTO alertas (usuario_id, serie, lado, tipo, umbral)
         SELECT $1, $2, $3, $4, $5 WHERE (SELECT COUNT(*) FROM alertas WHERE usuario_id = $1) < $6
         RETURNING ${COLUMNAS}`, [usuarioId, serie, lado, tipo, umbral, maximo]);
      return aAlerta(r.rows[0]) || null;
    },
    async listar(usuarioId) {
      const r = await db.query(`SELECT ${COLUMNAS} FROM alertas WHERE usuario_id = $1 ORDER BY id`, [usuarioId]);
      return r.rows.map(aAlerta);
    },
    async cambiarActiva({ usuarioId, id, activa }) {
      const r = await db.query(`UPDATE alertas SET activa = $3 WHERE id = $2 AND usuario_id = $1 RETURNING ${COLUMNAS}`, [usuarioId, id, activa]);
      return aAlerta(r.rows[0]) || null;
    },
    async eliminar({ usuarioId, id }) {
      const r = await db.query('DELETE FROM alertas WHERE id = $2 AND usuario_id = $1', [usuarioId, id]);
      return r.rowCount > 0;
    },

    // Para el notificador: alertas activas de usuarios con el correo CONFIRMADO, junto con su correo
    async activasConCorreo() {
      const r = await db.query(
        `SELECT a.id, a.usuario_id, a.serie, a.lado, a.tipo, a.umbral, a.activa, a.ultimo_aviso_en, a.creada_en, u.correo
           FROM alertas a JOIN usuarios u ON u.id = a.usuario_id
          WHERE a.activa AND u.verificado_en IS NOT NULL ORDER BY a.id`);
      return r.rows.map((f) => ({ ...aAlerta(f), correo: f.correo }));
    },
    // "Reclamar" el aviso: marca la hora ANTES de enviar y solo si pasó el tiempo de espera. Si dos procesos
    // coinciden, solo uno lo consigue; así nunca se envía el mismo aviso dos veces.
    async reclamarAviso({ id, ahora, esperaHasta }) {
      const r = await db.query(
        `UPDATE alertas SET ultimo_aviso_en = $2
          WHERE id = $1 AND activa AND (ultimo_aviso_en IS NULL OR ultimo_aviso_en <= $3) RETURNING id`, [id, ahora, esperaHasta]);
      return r.rowCount > 0;
    },
    // Si el envío falló, se devuelve la marca anterior para reintentar en la siguiente vuelta
    async liberarAviso({ id, ahora, anterior }) {
      await db.query('UPDATE alertas SET ultimo_aviso_en = $3 WHERE id = $1 AND ultimo_aviso_en = $2', [id, ahora, anterior]);
    },
  };
}

module.exports = { crearRepositorioAlertas };
