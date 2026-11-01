// Notificador: revisa las alertas activas contra los últimos precios guardados y avisa por correo.
// Es la mitad de un mini "microservicio": el recolector escribe los precios en PostgreSQL y este proceso los lee.
// No conversan entre sí; solo comparten la base. Si uno se cae, el otro sigue.
const { SERIES } = require('../dominio/historico');
const { describir, evaluar } = require('../dominio/alertas');
const { correoAlerta } = require('../mailer/plantillas');
const { fechaBolivia } = require('../utilidades/fechas');
const { sumarDias } = require('./historicoService');

const INSTRUMENTOS = Object.values(SERIES).map((s) => s.instrumento);

function crearRevisorAlertas({
  alertas, cotizaciones, mailer, urlPublica, enfriamientoHoras, ahora = () => new Date(), logger = console,
}) {
  const enfriamientoMs = enfriamientoHoras * 3_600_000;
  const valorDe = (obs, lado) => (lado === 'compra' ? obs.compra : obs.venta ?? obs.valor);

  // Último precio VIGENTE de cada serie (un dato "desactualizado" no sirve para avisar nada)
  async function preciosActuales() {
    const filas = await cotizaciones.ultimas(INSTRUMENTOS);
    const porSerie = {};
    for (const [serie, { instrumento, entidad }] of Object.entries(SERIES)) {
      const obs = filas.find((f) => f.instrumento === instrumento && f.entidad === entidad && f.estado === 'vigente');
      if (obs) porSerie[serie] = obs;
    }
    return porSerie;
  }

  // Valor con el que cerró el último día anterior a hoy que tenga datos (para las alertas de cambio porcentual)
  async function cierreAnterior(serie, lado, hoy) {
    const dias = await cotizaciones.ultimoPorDia({ ...SERIES[serie], desde: sumarDias(hoy, -7) });
    const previos = dias.filter((d) => d.fecha < hoy);
    return previos.length ? valorDe(previos[previos.length - 1], lado) : null;
  }

  return {
    // Una vuelta de revisión. Devuelve un resumen para el registro.
    async revisar() {
      const momento = ahora();
      const hoy = fechaBolivia(momento);
      const lista = await alertas.activasConCorreo();
      if (!lista.length) return { revisadas: 0, enviados: 0, fallidos: 0 };
      const precios = await preciosActuales();
      const cierres = new Map();
      const resumen = { revisadas: lista.length, enviados: 0, fallidos: 0 };

      for (const alerta of lista) {
        try {
          if (alerta.ultimoAvisoEn && momento - alerta.ultimoAvisoEn < enfriamientoMs) continue; // todavía en espera
          const obs = precios[alerta.serie];
          if (!obs) continue; // sin dato vigente: no se avisa con datos viejos
          let cierre = null;
          if (alerta.tipo === 'cambio_pct') {
            const clave = `${alerta.serie}/${alerta.lado}`;
            if (!cierres.has(clave)) cierres.set(clave, await cierreAnterior(alerta.serie, alerta.lado, hoy));
            cierre = cierres.get(clave);
          }
          const actual = valorDe(obs, alerta.lado);
          const { cumple, cambioPct } = evaluar(alerta, { actual, cierreAnterior: cierre });
          if (!cumple) continue;

          // Se reclama el aviso antes de enviar; si el envío falla se devuelve la marca para reintentar
          const reclamado = await alertas.reclamarAviso({ id: alerta.id, ahora: momento, esperaHasta: new Date(momento - enfriamientoMs) });
          if (!reclamado) continue;
          try {
            await mailer.enviar({ para: alerta.correo, ...correoAlerta({ descripcion: describir(alerta), actual, cierre, cambioPct, urlPublica, horas: enfriamientoHoras }) });
            resumen.enviados += 1;
            logger.log(`[notificador] aviso enviado: alerta ${alerta.id} (${describir(alerta)})`);
          } catch (err) {
            await alertas.liberarAviso({ id: alerta.id, ahora: momento, anterior: alerta.ultimoAvisoEn });
            throw err;
          }
        } catch (err) {
          resumen.fallidos += 1;
          logger.error(`[notificador] alerta ${alerta.id}: ${err.message}`); // una alerta con problemas no detiene a las demás
        }
      }
      return resumen;
    },
  };
}

// Convierte el revisor en una tarea para el programador de tareas (el mismo del recolector)
const crearTareaNotificador = ({ revisor, cadaMin }) => ({
  nombre: 'alertas',
  cadaMin,
  async ejecutar() {
    const r = await revisor.revisar();
    return `${r.revisadas} alerta(s) revisada(s), ${r.enviados} aviso(s) enviado(s)${r.fallidos ? `, ${r.fallidos} con error` : ''}`;
  },
});

module.exports = { crearRevisorAlertas, crearTareaNotificador };
