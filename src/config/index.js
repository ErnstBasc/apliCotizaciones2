// Configuración global: lee el entorno UNA sola vez y lo entrega como objeto.
// Ningún otro archivo debería tocar process.env; así los cambios de configuración viven aquí.
// (El archivo .env lo carga server.js con dotenv antes de llamar a cargarConfig.)

// Lee minutos desde el entorno. 0 = sin caché; acepta decimales; si es inválido usa el valor por defecto.
function minutosDesdeEnv(env, nombre, porDefecto) {
  const bruto = env[nombre];
  if (bruto === undefined || bruto === '') return porDefecto;
  const n = Number(bruto);
  return Number.isFinite(n) && n >= 0 ? n : porDefecto;
}

function listaDesdeEnv(env, nombre) {
  return (env[nombre] || '').split(',').map((s) => s.trim()).filter(Boolean);
}

// Secreto con el que se firman las sesiones (JWT). En producción es obligatorio; en desarrollo, si falta, server.js
// genera uno temporal (las sesiones se pierden al reiniciar). Un secreto corto sí se rechaza siempre.
function secretoDesdeEnv(env, entorno) {
  const s = env.JWT_SECRET;
  if (!s) {
    if (entorno === 'production') throw new Error('Falta JWT_SECRET en producción (mínimo 32 caracteres)');
    return undefined;
  }
  if (s.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  return s;
}

// Recibe el entorno como parámetro para poder probarlo sin tocar process.env real.
function cargarConfig(env = process.env) {
  const entorno = env.NODE_ENV || 'development';
  const puerto = Number(env.PORT) || 3000;
  return {
    entorno,
    puerto,
    db: {
      host: env.DB_HOST || 'localhost',
      port: Number(env.DB_PORT) || 5432,
      user: env.DB_USER || 'postgres',
      password: env.DB_PASSWORD,
      database: env.DB_NAME || 'aplicotizaciones2',
    },
    cacheMin: {
      monedas: minutosDesdeEnv(env, 'CACHE_MONEDAS_MIN', 10),
      oficial: minutosDesdeEnv(env, 'CACHE_OFICIAL_MIN', 60),
      paralelo: minutosDesdeEnv(env, 'CACHE_PARALELO_MIN', 10),
      indicadores: minutosDesdeEnv(env, 'CACHE_INDICADORES_MIN', 60),
      billeteras: minutosDesdeEnv(env, 'CACHE_BILLETERAS_MIN', 10),
      bancos: minutosDesdeEnv(env, 'CACHE_BANCOS_MIN', 30),
    },
    // Cada cuántos minutos el recolector consulta cada fuente por su cuenta. 0 = esa tarea queda desactivada.
    recolectorMin: {
      paralelo: minutosDesdeEnv(env, 'RECOLECTOR_PARALELO_MIN', 15),
      billeteras: minutosDesdeEnv(env, 'RECOLECTOR_BILLETERAS_MIN', 15),
      bancos: minutosDesdeEnv(env, 'RECOLECTOR_BANCOS_MIN', 60),
      oficial: minutosDesdeEnv(env, 'RECOLECTOR_OFICIAL_MIN', 60),
      indicadores: minutosDesdeEnv(env, 'RECOLECTOR_INDICADORES_MIN', 360),
      monedas: minutosDesdeEnv(env, 'RECOLECTOR_MONEDAS_MIN', 360),
    },
    corsOrigenes: listaDesdeEnv(env, 'CORS_ORIGINS'),
    auth: {
      secreto: secretoDesdeEnv(env, entorno),
      duracionDias: minutosDesdeEnv(env, 'SESION_DIAS', 7) || 7,
      cookieSegura: entorno === 'production', // en producción la cookie solo viaja por HTTPS
      urlPublica: (env.APP_URL || `http://localhost:${puerto}`).replace(/\/+$/, ''), // base de los enlaces de los correos
    },
    correo: { modo: env.MAIL_MODO || 'consola' },
  };
}

module.exports = { cargarConfig, minutosDesdeEnv, listaDesdeEnv, secretoDesdeEnv };
