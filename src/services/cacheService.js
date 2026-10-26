// Servicio de caché genérico (cache-aside con vigencia, guardado en PostgreSQL).
// No sabe NADA de BCB, Binance ni bancos: recibe un adaptador y una vigencia, y decide si
// responde desde la base o consulta la fuente. Cada fuente nueva reutiliza este mismo código (Abierto/Cerrado).
//
//   ¿hay datos guardados y vigentes?  ── sí ──► responde desde la base
//                  │ no
//                  ▼
//   consulta la fuente ── ok ──► guarda y responde
//                  │ falla
//                  ▼
//   ¿hay datos viejos? ── sí ──► responde con desactualizado: true
//                  │ no
//                  ▼
//               ErrorFuente (502)

const { ErrorFuente } = require('../errores');

function crearServicioCache({ repositorio, reloj = () => Date.now(), logger = console }) {
  const enCurso = new Map(); // consultas en vuelo: evita lanzar 50 peticiones iguales a la fuente a la vez

  // "instrumentos": códigos que produce el adaptador; "vigenciaMin": minutos (0 = sin caché)
  async function resolver({ adaptador, instrumentos, vigenciaMin }) {
    const guardadas = await repositorio.ultimas(instrumentos);

    if (guardadas.length > 0 && vigenciaMin > 0) {
      const masReciente = Math.max(...guardadas.map((o) => o.obtenidoEn.getTime()));
      // Comparación estricta (<): con vigencia 0 nunca se considera vigente.
      if (reloj() - masReciente < vigenciaMin * 60_000) {
        return { origen: 'cache', desactualizado: false, observaciones: guardadas };
      }
    }

    try {
      // Un adaptador puede devolver un arreglo, o { fuente, observaciones } si la fuente real varía (ver conRespaldo.js)
      const respuesta = await adaptador.obtener();
      const nuevas = Array.isArray(respuesta) ? respuesta : respuesta.observaciones;
      const fuente = Array.isArray(respuesta) ? adaptador.nombre : respuesta.fuente;
      await repositorio.guardarVarias(nuevas, fuente);
      const actuales = await repositorio.ultimas(instrumentos);
      return { origen: fuente, desactualizado: false, observaciones: actuales };
    } catch (err) {
      logger.error(`[cache] falló la fuente "${adaptador.nombre}": ${err.message}`);
      if (guardadas.length > 0) {
        return { origen: 'cache', desactualizado: true, observaciones: guardadas };
      }
      throw new ErrorFuente(adaptador.nombre, err.message);
    }
  }

  return {
    obtener(parametros) {
      const clave = `${parametros.adaptador.nombre}:${[...parametros.instrumentos].sort().join(',')}`;
      if (enCurso.has(clave)) return enCurso.get(clave);
      const promesa = resolver(parametros).finally(() => enCurso.delete(clave));
      enCurso.set(clave, promesa);
      return promesa;
    },
  };
}

module.exports = { crearServicioCache };
