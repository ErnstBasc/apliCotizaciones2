// Crea (o restablece) la cuenta de administrador, o le quita el rol. Se ejecuta en el servidor, nunca desde la web.
//   npm run admin:crear -- correo@ejemplo.com            → pide la contraseña (no se muestra al escribir)
//   npm run admin:crear -- correo@ejemplo.com --quitar   → devuelve la cuenta a usuario común
// Sin teclado (por ejemplo, dentro de Docker): ADMIN_CLAVE="..." npm run admin:crear -- correo@ejemplo.com
// La contraseña NO se pasa como argumento (quedaría en el historial de la terminal).
require('dotenv').config();
const readline = require('node:readline');
const { cargarConfig } = require('../src/config');
const { crearPool } = require('../src/repositories/pool');
const { crearRepositorioUsuarios } = require('../src/repositories/usuariosRepositorio');
const { crearServicioAdministradores } = require('../src/services/administradoresService');
const claves = require('../src/utilidades/claves');

// Pregunta sin mostrar lo que se escribe
function preguntarOculto(texto) {
  return new Promise((resolver) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let oculto = false;
    const original = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (cadena) => { if (!oculto) original(cadena); };
    rl.question(texto, (respuesta) => { rl.close(); process.stdout.write('\n'); resolver(respuesta); });
    oculto = true;
  });
}

async function main() {
  const [correo, ...opciones] = process.argv.slice(2);
  if (!correo || correo.startsWith('--')) throw new Error('Indica el correo: npm run admin:crear -- correo@ejemplo.com');
  const pool = crearPool(cargarConfig().db);
  const servicio = crearServicioAdministradores({ repositorio: crearRepositorioUsuarios(pool), claves });
  try {
    if (opciones.includes('--quitar')) {
      const hecho = await servicio.quitar({ correo });
      console.log(hecho ? `Listo: ${correo} ya no es administrador (sus sesiones se cerraron).` : `${correo} no era administrador. No se cambió nada.`);
      return;
    }
    let clave = process.env.ADMIN_CLAVE;
    if (!clave) {
      clave = await preguntarOculto('Contraseña del administrador (12 caracteres o más): ');
      if (clave !== await preguntarOculto('Repítela: ')) throw new Error('Las contraseñas no coinciden.');
    }
    const admin = await servicio.crear({ correo, clave });
    console.log(`Listo: ${admin.correo} es administrador. Ingresa con ese correo y esa contraseña en la página.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(`\nNo se pudo: ${err.message}`); process.exit(1); });
