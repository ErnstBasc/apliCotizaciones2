// Alta y baja de administradores. NO hay forma de hacerlo desde la web: solo el script `npm run admin:crear`,
// ejecutado por quien controla el servidor. Así, aunque alguien rompiera la página, no podría nombrarse administrador.
const { ErrorValidacion } = require('../errores');
const { validarCorreo } = require('../routes/validacion');

const CLAVE_ADMIN_MIN = 12; // más exigente que la de un usuario común (10)
const CLAVE_ADMIN_MAX = 128;
const ROLES_ASIGNABLES = ['registrado', 'premium'];

function crearServicioAdministradores({ repositorio, claves, ahora = () => new Date() }) {
  return {
    // Crea el administrador o convierte en admin una cuenta existente (y le fija esta clave). Repetirlo = restablecer su clave.
    async crear({ correo, clave }) {
      const { correo: normalizado } = validarCorreo({ correo });
      if (typeof clave !== 'string' || clave.length < CLAVE_ADMIN_MIN || clave.length > CLAVE_ADMIN_MAX) {
        throw new ErrorValidacion(`La contraseña del administrador debe tener entre ${CLAVE_ADMIN_MIN} y ${CLAVE_ADMIN_MAX} caracteres`);
      }
      const usuario = await repositorio.fijarAdmin({ correo: normalizado, claveHash: await claves.hashear(clave), ahora: ahora() });
      return { id: usuario.id, correo: usuario.correo, rol: usuario.rol };
    },
    // Asigna "premium" o "registrado" a una cuenta existente (no a administradores). null si no existe o es admin.
    async asignarRol({ correo, rol }) {
      const { correo: normalizado } = validarCorreo({ correo });
      if (!ROLES_ASIGNABLES.includes(rol)) throw new ErrorValidacion(`El rol debe ser: ${ROLES_ASIGNABLES.join(' o ')}`);
      const usuario = await repositorio.cambiarRol({ correo: normalizado, rol });
      return usuario ? { correo: usuario.correo, rol: usuario.rol } : null;
    },
    // Devuelve la cuenta a "registrado". false si ese correo no era administrador.
    async quitar({ correo }) {
      const { correo: normalizado } = validarCorreo({ correo });
      return Boolean(await repositorio.quitarAdmin(normalizado));
    },
  };
}

module.exports = { crearServicioAdministradores, CLAVE_ADMIN_MIN, ROLES_ASIGNABLES };
