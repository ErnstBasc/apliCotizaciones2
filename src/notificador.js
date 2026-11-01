// Punto de entrada del notificador (npm run notificador). Proceso APARTE, igual que el recolector:
// lee los precios que el recolector dejó en PostgreSQL y envía los avisos de las alertas por correo.
require('dotenv').config();

const { cargarConfig } = require('./config');
const { crearPool } = require('./repositories/pool');
const { crearRepositorioCotizaciones } = require('./repositories/cotizacionesRepositorio');
const { crearRepositorioAlertas } = require('./repositories/alertasRepositorio');
const { crearRecolector } = require('./services/recolector'); // el mismo programador de tareas sirve aquí
const { crearRevisorAlertas, crearTareaNotificador } = require('./services/notificador');
const { crearMailer } = require('./composicion');

async function main() {
  const config = cargarConfig();
  if (!(config.notificadorMin > 0)) {
    console.log('[notificador] NOTIFICADOR_MIN es 0: está desactivado.');
    return;
  }
  const pool = crearPool(config.db);
  const mailer = crearMailer(config);
  if (mailer.verificar) { // con SMTP real, se comprueban host y credenciales ANTES de empezar
    try { await mailer.verificar(); console.log('[notificador] conexión SMTP verificada'); } catch (err) {
      console.error(`[notificador] no se pudo conectar con el servidor de correo: ${err.message}`);
      await pool.end();
      process.exit(1);
    }
  } else {
    console.log(`[notificador] mailer "${mailer.nombre}": los avisos se imprimen en esta terminal, no se envían.`);
  }

  const revisor = crearRevisorAlertas({
    alertas: crearRepositorioAlertas(pool),
    cotizaciones: crearRepositorioCotizaciones(pool),
    mailer,
    urlPublica: config.auth.urlPublica,
    enfriamientoHoras: config.alertas.enfriamientoHoras,
  });
  const programador = crearRecolector({ tareas: [crearTareaNotificador({ revisor, cadaMin: config.notificadorMin })], prefijo: 'notificador' });
  programador.iniciar();

  let cerrando = false;
  async function cerrar() {
    if (cerrando) return;
    cerrando = true;
    console.log('\n[notificador] cerrando…');
    await programador.detener();
    await pool.end();
    process.exit(0);
  }
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

main().catch((err) => { console.error('[notificador] no se pudo iniciar:', err.message); process.exit(1); });
