// Asigna el rol premium (o lo quita) a una cuenta YA registrada. Se ejecuta en el servidor: no hay pagos ni pantalla para esto.
//   npm run usuario:rol -- correo@ejemplo.com premium
//   npm run usuario:rol -- correo@ejemplo.com registrado     → vuelve a usuario común
// No sirve para administradores (eso es npm run admin:crear). El cambio rige de inmediato: el rol se lee de la base en cada petición.
require('dotenv').config();
const { cargarConfig } = require('../src/config');
const { crearPool } = require('../src/repositories/pool');
const { crearRepositorioUsuarios } = require('../src/repositories/usuariosRepositorio');
const { crearServicioAdministradores, ROLES_ASIGNABLES } = require('../src/services/administradoresService');
const claves = require('../src/utilidades/claves');

async function main() {
  const [correo, rol] = process.argv.slice(2);
  if (!correo || !rol) throw new Error(`Uso: npm run usuario:rol -- correo@ejemplo.com ${ROLES_ASIGNABLES.join('|')}`);
  const pool = crearPool(cargarConfig().db);
  try {
    const servicio = crearServicioAdministradores({ repositorio: crearRepositorioUsuarios(pool), claves });
    const r = await servicio.asignarRol({ correo, rol });
    console.log(r ? `Listo: ${r.correo} ahora es "${r.rol}".` : `No se cambió nada: ${correo} no está registrado o es administrador.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(`\nNo se pudo: ${err.message}`); process.exit(1); });
