// Recolector: consulta las fuentes por su cuenta, a intervalos, y deja cada lectura guardada en la base.
// Así el histórico se llena aunque nadie abra la página. No sabe de BCB, Binance ni bancos: recibe "tareas"
// ({ nombre, cadaMin, ejecutar }) desde afuera, igual que el caché recibe adaptadores (Abierto/Cerrado).
//
// Reglas de diseño:
//  - Cada tarea espera a terminar ANTES de programar la siguiente (setTimeout encadenado, no setInterval):
//    nunca hay dos ejecuciones de la misma tarea a la vez, ni aunque una fuente tarde más que el intervalo.
//  - Un error en una tarea se registra y no detiene a las demás ni al proceso.
//  - Las primeras ejecuciones se escalonan unos segundos para no golpear todas las fuentes a la vez.
//  - Los temporizadores se reciben desde afuera para poder probar el tiempo sin esperar minutos reales.

const ORDEN = ['paralelo', 'billeteras', 'bancos', 'oficial', 'indicadores', 'monedas'];

// Convierte el servicio de cotizaciones en tareas. Minutos en 0 (o inválidos) = tarea desactivada.
// OJO: con vigencia 0 el caché siempre consulta la fuente, pero si la fuente falla y hay datos viejos
// responde con ellos marcados "desactualizado". Para el recolector eso es un FALLO: no se refrescó nada.
function crearTareas({ cotizaciones, cadaMin }) {
  return ORDEN.filter((nombre) => cadaMin[nombre] > 0).map((nombre) => ({
    nombre,
    cadaMin: cadaMin[nombre],
    async ejecutar() {
      const r = await cotizaciones[nombre]();
      if (r.desactualizado) throw new Error('la fuente no respondió; se conservan los datos anteriores');
      return `origen ${r.origen}, ${r.observaciones.length} dato(s)`;
    },
  }));
}

function crearRecolector({
  tareas, logger = console, escalonadoMs = 3000, reloj = () => Date.now(),
  setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout,
}) {
  const estados = new Map(tareas.map((t) => [t.nombre, {
    nombre: t.nombre, cadaMin: t.cadaMin, ejecutando: null, temporizador: null,
    ejecuciones: 0, fallos: 0, ultimaOk: null, ultimoError: null,
  }]));
  let activo = false;

  async function correr(tarea) {
    const e = estados.get(tarea.nombre);
    if (!activo || e.ejecutando) return; // sin solapes
    e.temporizador = null;
    e.ejecutando = (async () => {
      e.ejecuciones += 1;
      try {
        const resumen = await tarea.ejecutar();
        e.ultimaOk = new Date(reloj()).toISOString();
        e.ultimoError = null;
        logger.log(`[recolector] ${tarea.nombre}: ok (${resumen})`);
      } catch (err) {
        e.fallos += 1;
        e.ultimoError = err.message;
        logger.error(`[recolector] ${tarea.nombre}: falló (${err.message})`);
      }
    })();
    await e.ejecutando;
    e.ejecutando = null;
    if (activo) e.temporizador = setTimeoutFn(() => correr(tarea), tarea.cadaMin * 60_000);
  }

  return {
    iniciar() {
      if (activo) return;
      activo = true;
      tareas.forEach((t, i) => {
        estados.get(t.nombre).temporizador = setTimeoutFn(() => correr(t), i * escalonadoMs);
      });
      logger.log(`[recolector] iniciado con ${tareas.length} tarea(s): ${tareas.map((t) => `${t.nombre} cada ${t.cadaMin} min`).join(', ') || 'ninguna'}`);
    },

    // Cancela lo pendiente y espera a que termine lo que esté en curso (cierre ordenado)
    async detener() {
      activo = false;
      for (const e of estados.values()) {
        if (e.temporizador) clearTimeoutFn(e.temporizador);
        e.temporizador = null;
      }
      await Promise.all([...estados.values()].map((e) => e.ejecutando));
      logger.log('[recolector] detenido');
    },

    estado() {
      return [...estados.values()].map(({ nombre, cadaMin, ejecuciones, fallos, ultimaOk, ultimoError, ejecutando }) => (
        { nombre, cadaMin, ejecuciones, fallos, ultimaOk, ultimoError, corriendo: Boolean(ejecutando) }));
    },
  };
}

module.exports = { crearRecolector, crearTareas, ORDEN };
