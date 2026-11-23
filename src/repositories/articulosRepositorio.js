// Artículos premium. La lista NUNCA trae el cuerpo: así es imposible que se filtre por error en la ruta pública.
const COLUMNAS_PUBLICAS = 'id, titulo, autor, resumen, publicado_en';

const aPublico = (f) => ({ id: f.id, titulo: f.titulo, autor: f.autor, resumen: f.resumen, publicadoEn: new Date(f.publicado_en).toISOString() });

function crearRepositorioArticulos(db) {
  return {
    async listar() {
      const { rows } = await db.query(`SELECT ${COLUMNAS_PUBLICAS} FROM articulos ORDER BY publicado_en DESC, id DESC`);
      return rows.map(aPublico);
    },
    async obtener(id) {
      const { rows } = await db.query(`SELECT ${COLUMNAS_PUBLICAS}, cuerpo FROM articulos WHERE id = $1`, [id]);
      return rows[0] ? { ...aPublico(rows[0]), cuerpo: rows[0].cuerpo } : null;
    },
  };
}

module.exports = { crearRepositorioArticulos };
