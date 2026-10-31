// Acceso a datos de usuarios y tokens. Solo SQL parametrizado ($1, $2…): los datos nunca se pegan dentro del texto SQL.
const COLUMNAS = 'id, correo, clave_hash, rol, verificado_en, intentos_fallidos, bloqueado_hasta, version_sesion, creado_en';

const aUsuario = (f) => f && {
  id: Number(f.id),
  correo: f.correo,
  claveHash: f.clave_hash,
  rol: f.rol,
  verificadoEn: f.verificado_en ? new Date(f.verificado_en) : null,
  intentosFallidos: f.intentos_fallidos,
  bloqueadoHasta: f.bloqueado_hasta ? new Date(f.bloqueado_hasta) : null,
  versionSesion: f.version_sesion,
  creadoEn: new Date(f.creado_en),
};

function crearRepositorioUsuarios(db) {
  const uno = async (sql, params) => aUsuario((await db.query(sql, params)).rows[0]) || null;

  return {
    // Devuelve el usuario creado, o null si el correo ya existía (la restricción única decide, sin carreras).
    crear: ({ correo, claveHash }) => uno(
      `INSERT INTO usuarios (correo, clave_hash) VALUES ($1, $2) ON CONFLICT (correo) DO NOTHING RETURNING ${COLUMNAS}`,
      [correo, claveHash]),
    buscarPorCorreo: (correo) => uno(`SELECT ${COLUMNAS} FROM usuarios WHERE correo = $1`, [correo]),
    buscarPorId: (id) => uno(`SELECT ${COLUMNAS} FROM usuarios WHERE id = $1`, [id]),

    marcarVerificado: (id, ahora) => db.query('UPDATE usuarios SET verificado_en = COALESCE(verificado_en, $2) WHERE id = $1', [id, ahora]),

    // Cuenta el fallo y, al llegar al máximo, bloquea hasta la fecha dada. Todo en UNA sentencia (atómico).
    registrarFallo: (id, { maximo, bloqueadoHasta }) => db.query(
      `UPDATE usuarios SET
         intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= $2 THEN 0 ELSE intentos_fallidos + 1 END,
         bloqueado_hasta   = CASE WHEN intentos_fallidos + 1 >= $2 THEN $3 ELSE bloqueado_hasta END
       WHERE id = $1`, [id, maximo, bloqueadoHasta]),
    reiniciarIntentos: (id) => db.query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1', [id]),

    // Cambia la clave y sube la versión de sesión (cierra las demás sesiones). Devuelve el usuario actualizado.
    actualizarClave: (id, claveHash) => uno(
      `UPDATE usuarios SET clave_hash = $2, version_sesion = version_sesion + 1, intentos_fallidos = 0, bloqueado_hasta = NULL
       WHERE id = $1 RETURNING ${COLUMNAS}`, [id, claveHash]),

    eliminar: (id) => db.query('DELETE FROM usuarios WHERE id = $1', [id]), // los tokens caen en cascada

    // Un token nuevo reemplaza a los anteriores no usados del mismo tipo (solo sirve el último enlace enviado).
    guardarToken: ({ usuarioId, tipo, tokenHash, expiraEn }) => db.query(
      `WITH borrados AS (DELETE FROM tokens_usuario WHERE usuario_id = $1 AND tipo = $2 AND usado_en IS NULL)
       INSERT INTO tokens_usuario (usuario_id, tipo, token_hash, expira_en) VALUES ($1, $2, $3, $4)`,
      [usuarioId, tipo, tokenHash, expiraEn]),

    // Consumir = marcar usado y devolver el dueño, en UNA sentencia: dos peticiones simultáneas no pueden usar el mismo token.
    consumirToken: async ({ tokenHash, tipo, ahora }) => {
      const r = await db.query(
        `UPDATE tokens_usuario SET usado_en = $3
         WHERE token_hash = $1 AND tipo = $2 AND usado_en IS NULL AND expira_en > $3
         RETURNING usuario_id`, [tokenHash, tipo, ahora]);
      return r.rows[0] ? Number(r.rows[0].usuario_id) : null;
    },
  };
}

module.exports = { crearRepositorioUsuarios };
