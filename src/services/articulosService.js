// Artículos de análisis: el título y el resumen son públicos; el texto completo es para premium (y el administrador).
// La regla de QUIÉN puede leer vive en la ruta (middleware exigirRol); aquí solo se arma la respuesta.
const { ErrorApp } = require('../errores');

const ROLES_LECTORES = ['premium', 'admin'];

// El cuerpo se guarda como texto plano: párrafos separados por una línea en blanco.
const aParrafos = (cuerpo) => String(cuerpo).split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);

function crearServicioArticulos({ repositorio }) {
  return {
    async listar() {
      return { articulos: await repositorio.listar(), lectores: ROLES_LECTORES };
    },
    async leer(id) {
      const articulo = await repositorio.obtener(id);
      if (!articulo) throw new ErrorApp(404, 'Ese artículo no existe');
      const { cuerpo, ...resto } = articulo;
      return { articulo: { ...resto, parrafos: aParrafos(cuerpo) } };
    },
  };
}

module.exports = { crearServicioArticulos, ROLES_LECTORES, aParrafos };
