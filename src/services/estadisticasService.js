// Arma el resumen que ve el administrador. No conoce HTTP ni SQL: recibe el repositorio.
// Solo entrega totales (nada de correos ni datos de personas concretas).
const { fechaBolivia } = require('../utilidades/fechas');
const { sumarDias } = require('./historicoService');

// Todas las fechas entre dos días (ambos incluidos). Los días sin datos quedan en cero: la serie siempre es continua.
function fechasEntre(desde, hasta) {
  const fechas = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) fechas.push(f);
  return fechas;
}

const sumar = (lista) => lista.reduce((a, x) => a + x, 0);

function crearServicioEstadisticas({ repositorio, ahora = () => new Date() }) {
  return {
    async resumen({ dias = 30 } = {}) {
      const momento = ahora();
      const hasta = fechaBolivia(momento);
      const desde = sumarDias(hasta, -(dias - 1));
      const [usuarios, altas, alertas, avisos, usoDias, rutas, primerDia, datos] = await Promise.all([
        repositorio.usuarios(), repositorio.altasPorDia(desde), repositorio.alertas(), repositorio.avisos(desde),
        repositorio.usoPorDia(desde), repositorio.usoPorRuta(desde), repositorio.primerDiaDeUso(), repositorio.datos(),
      ]);
      const fechas = fechasEntre(desde, hasta);
      const altasPorFecha = new Map(altas.map((a) => [a.fecha, a.total]));
      const uso = (fecha, tipo) => usoDias.find((u) => u.fecha === fecha && u.tipo === tipo)?.total ?? 0;
      const porDia = fechas.map((fecha) => ({ fecha, peticiones: uso(fecha, 'peticion'), descargas: uso(fecha, 'descarga') }));

      return {
        generadoEn: momento.toISOString(),
        periodo: { dias, desde, hasta },
        usuarios: {
          total: usuarios.total, verificados: usuarios.verificados, porRol: usuarios.porRol,
          altasEnPeriodo: sumar(altas.map((a) => a.total)),
          altasPorDia: fechas.map((fecha) => ({ fecha, total: altasPorFecha.get(fecha) ?? 0 })),
        },
        alertas: { total: alertas.total, activas: alertas.activas, avisosEnviados: avisos.total, avisosEnPeriodo: avisos.enPeriodo },
        uso: {
          medidoDesde: primerDia, // antes de este día no existían contadores: los ceros anteriores significan "sin medir"
          peticiones: sumar(porDia.map((d) => d.peticiones)),
          descargas: sumar(porDia.map((d) => d.descargas)),
          porDia,
          rutas,
        },
        datos,
      };
    },
  };
}

module.exports = { crearServicioEstadisticas, fechasEntre };
