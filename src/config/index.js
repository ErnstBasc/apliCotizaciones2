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

// Recibe el entorno como parámetro para poder probarlo sin tocar process.env real.
function cargarConfig(env = process.env) {
  return {
    entorno: env.NODE_ENV || 'development',
    puerto: Number(env.PORT) || 3000,
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
    corsOrigenes: listaDesdeEnv(env, 'CORS_ORIGINS'),
  };
}

module.exports = { cargarConfig, minutosDesdeEnv, listaDesdeEnv };
