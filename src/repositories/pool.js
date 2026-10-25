// Crea el pool de conexiones a PostgreSQL. Un pool reutiliza conexiones abiertas en vez de abrir una por consulta.
const { Pool } = require('pg');

function crearPool(configDb) {
  return new Pool(configDb);
}

module.exports = { crearPool };
