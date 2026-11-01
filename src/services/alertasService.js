// Alertas del usuario: crear, listar, pausar/reanudar y eliminar, con tope por usuario.
const { ErrorApp, ErrorNoEncontrado } = require('../errores');
const { describir } = require('../dominio/alertas');

const publica = (a) => ({
  id: a.id, serie: a.serie, lado: a.lado, tipo: a.tipo, umbral: a.umbral, activa: a.activa,
  descripcion: describir(a), ultimoAviso: a.ultimoAvisoEn, creadaEn: a.creadaEn,
});

function crearServicioAlertas({ repositorio, maximoPorUsuario, enfriamientoHoras }) {
  return {
    async listar(usuarioId) {
      return { maximo: maximoPorUsuario, enfriamientoHoras, alertas: (await repositorio.listar(usuarioId)).map(publica) };
    },
    async crear(usuarioId, datos) {
      const alerta = await repositorio.crear({ usuarioId, ...datos, maximo: maximoPorUsuario });
      if (!alerta) throw new ErrorApp(409, `Ya tienes ${maximoPorUsuario} alertas. Elimina una para crear otra`);
      return publica(alerta);
    },
    async cambiarActiva(usuarioId, id, activa) {
      const alerta = await repositorio.cambiarActiva({ usuarioId, id, activa });
      if (!alerta) throw new ErrorNoEncontrado('Alerta no encontrada');
      return publica(alerta);
    },
    async eliminar(usuarioId, id) {
      if (!(await repositorio.eliminar({ usuarioId, id }))) throw new ErrorNoEncontrado('Alerta no encontrada');
      return { mensaje: 'Alerta eliminada' };
    },
  };
}

module.exports = { crearServicioAlertas, publica };
