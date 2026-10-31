// Reglas de negocio de las cuentas. No conoce HTTP ni SQL: recibe el repositorio, el mailer y el hasheo de claves.
// Principios de seguridad que aplica:
//   - No revela si un correo está registrado (mismas respuestas existan o no).
//   - Mensaje único para credenciales incorrectas; bloqueo temporal tras varios fallos.
//   - Tokens de un solo uso, con vencimiento, guardados solo como hash.
const crypto = require('node:crypto');
const { ErrorApp, ErrorValidacion } = require('../errores');
const plantillas = require('../mailer/plantillas');

const CREDENCIALES_MALAS = 'Correo o contraseña incorrectos';
const ENLACE_MALO = 'El enlace no es válido o ya venció';

const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex');
const nuevoToken = () => crypto.randomBytes(32).toString('base64url'); // 43 caracteres

// Lo único que sale hacia el cliente: nunca el hash ni los contadores internos
const publico = (u) => ({ id: u.id, correo: u.correo, rol: u.rol, verificado: Boolean(u.verificadoEn), creadoEn: u.creadoEn });
// Igual, más la versión de sesión (uso interno: la necesita la cookie; la ruta la quita antes de responder)
const conVersion = (u) => ({ ...publico(u), versionSesion: u.versionSesion });

function crearServicioUsuarios({
  repositorio, mailer, claves, urlPublica,
  ahora = () => new Date(), generarToken = nuevoToken, logger = console,
  limites = {},
}) {
  const cfg = { maxIntentos: 5, bloqueoMin: 15, verificacionHoras: 24, recuperacionMin: 60, ...limites };
  const enMinutos = (min) => new Date(ahora().getTime() + min * 60_000);
  let hashFalso; // para que "usuario inexistente" tarde lo mismo que "clave incorrecta"
  const claveFalsa = () => (hashFalso ??= claves.hashear('clave-que-nadie-tiene'));

  // El fallo de un correo no debe cambiar la respuesta (sería una pista sobre si la cuenta existe): se registra y se sigue.
  async function enviar(para, contenido) {
    try { await mailer.enviar({ para, ...contenido }); } catch (err) { logger.error('[correo] no se pudo enviar:', err.message); }
  }

  async function enviarVerificacion(usuario) {
    const token = generarToken();
    await repositorio.guardarToken({ usuarioId: usuario.id, tipo: 'verificacion', tokenHash: sha256(token), expiraEn: enMinutos(cfg.verificacionHoras * 60) });
    await enviar(usuario.correo, plantillas.correoVerificacion({ enlace: `${urlPublica}/?verificar=${token}`, horas: cfg.verificacionHoras }));
  }

  // true si la clave es correcta; false si no (y entonces se cuenta el fallo); lanza 429 si la cuenta está bloqueada
  async function exigirClave(usuario, clave) {
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora()) {
      throw new ErrorApp(429, 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo');
    }
    if (await claves.verificar(clave, usuario.claveHash)) {
      if (usuario.intentosFallidos > 0) await repositorio.reiniciarIntentos(usuario.id);
      return true;
    }
    await repositorio.registrarFallo(usuario.id, { maximo: cfg.maxIntentos, bloqueadoHasta: enMinutos(cfg.bloqueoMin) });
    return false;
  }

  return {
    async registrar({ correo, clave }) {
      const claveHash = await claves.hashear(clave);
      const usuario = await repositorio.crear({ correo, claveHash });
      if (usuario) await enviarVerificacion(usuario);
      else await enviar(correo, plantillas.correoCuentaExistente({ urlPublica }));
      return { mensaje: 'Si el correo es válido, te enviamos un mensaje para confirmarlo. Revisa tu bandeja.' };
    },

    async reenviarVerificacion({ correo }) {
      const usuario = await repositorio.buscarPorCorreo(correo);
      if (usuario && !usuario.verificadoEn) await enviarVerificacion(usuario);
      return { mensaje: 'Si la cuenta existe y falta confirmarla, te enviamos un nuevo mensaje.' };
    },

    async verificar({ token }) {
      const id = await repositorio.consumirToken({ tokenHash: sha256(token), tipo: 'verificacion', ahora: ahora() });
      if (!id) throw new ErrorValidacion(ENLACE_MALO);
      await repositorio.marcarVerificado(id, ahora());
      return { mensaje: 'Correo confirmado. Ya puedes usar todas las funciones de tu cuenta.' };
    },

    async ingresar({ correo, clave }) {
      const usuario = await repositorio.buscarPorCorreo(correo);
      if (!usuario) {
        await claves.verificar(clave, await claveFalsa());
        throw new ErrorApp(401, CREDENCIALES_MALAS);
      }
      if (!(await exigirClave(usuario, clave))) throw new ErrorApp(401, CREDENCIALES_MALAS);
      return conVersion(usuario);
    },

    // Para el middleware: ¿esta sesión sigue siendo válida? (el usuario existe y la versión coincide)
    async deSesion(carga) {
      if (!carga || !Number.isInteger(carga.sub)) return null;
      const usuario = await repositorio.buscarPorId(carga.sub);
      return usuario && usuario.versionSesion === carga.sv ? conVersion(usuario) : null;
    },

    async solicitarRecuperacion({ correo }) {
      const usuario = await repositorio.buscarPorCorreo(correo);
      if (usuario) {
        const token = generarToken();
        await repositorio.guardarToken({ usuarioId: usuario.id, tipo: 'recuperacion', tokenHash: sha256(token), expiraEn: enMinutos(cfg.recuperacionMin) });
        await enviar(usuario.correo, plantillas.correoRecuperacion({ enlace: `${urlPublica}/?restablecer=${token}`, minutos: cfg.recuperacionMin }));
      }
      return { mensaje: 'Si la cuenta existe, te enviamos un mensaje con los pasos para elegir una contraseña nueva.' };
    },

    async restablecer({ token, clave }) {
      const id = await repositorio.consumirToken({ tokenHash: sha256(token), tipo: 'recuperacion', ahora: ahora() });
      if (!id) throw new ErrorValidacion(ENLACE_MALO);
      await repositorio.actualizarClave(id, await claves.hashear(clave));
      await repositorio.marcarVerificado(id, ahora()); // recibir el enlace en su correo prueba que es suyo
      return { mensaje: 'Contraseña actualizada. Ingresa con la nueva.' };
    },

    // Devuelve el usuario con la versión de sesión nueva, para que la ruta renueve la cookie de ESTA sesión
    async cambiarClave({ usuarioId, claveActual, claveNueva }) {
      const usuario = await repositorio.buscarPorId(usuarioId);
      if (!usuario) throw new ErrorApp(401, 'Inicia sesión para continuar');
      if (!(await exigirClave(usuario, claveActual))) throw new ErrorApp(403, 'La contraseña actual no es correcta');
      if (claveActual === claveNueva) throw new ErrorValidacion('La contraseña nueva debe ser distinta de la actual');
      const actualizado = await repositorio.actualizarClave(usuario.id, await claves.hashear(claveNueva));
      return conVersion(actualizado);
    },

    async eliminarCuenta({ usuarioId, clave }) {
      const usuario = await repositorio.buscarPorId(usuarioId);
      if (!usuario) throw new ErrorApp(401, 'Inicia sesión para continuar');
      if (!(await exigirClave(usuario, clave))) throw new ErrorApp(403, 'La contraseña no es correcta');
      await repositorio.eliminar(usuario.id);
      return { mensaje: 'Tu cuenta y tus datos fueron eliminados.' };
    },
  };
}

module.exports = { crearServicioUsuarios, publico, sha256, CREDENCIALES_MALAS };
