const { errorRef, json } = require('../componentes');

const usuarioRef = { $ref: '#/components/schemas/Usuario' };
const mensajeRef = { $ref: '#/components/schemas/Mensaje' };
const protegida = [{ sesion: [] }];

const cuerpo = (propiedades, requeridos, ejemplo) => ({
  required: true,
  content: { 'application/json': { schema: { type: 'object', required: requeridos, properties: propiedades }, example: ejemplo } },
});
const correo = { type: 'string', format: 'email', example: 'ana@ejemplo.com' };
const clave = { type: 'string', minLength: 10, maxLength: 128, description: 'De 10 a 128 caracteres', example: 'una-clave-larga-1' };
const token = { type: 'string', minLength: 43, maxLength: 43, description: 'Código del enlace que llegó por correo', example: 'fG3x…(43 caracteres)' };

const r400 = json('Datos inválidos', errorRef);
const r401 = json('No hay sesión válida (o credenciales incorrectas)', errorRef);
const r403 = json('Contraseña incorrecta, correo sin confirmar u origen no permitido', errorRef);
const ok = (texto, ejemplo) => json(texto, mensajeRef, { mensaje: ejemplo });

module.exports = {
  '/usuarios/registro': { post: {
    tags: ['Usuarios'], summary: 'Crear una cuenta',
    description: 'Crea la cuenta y envía un enlace para confirmar el correo. **Responde lo mismo exista o no el correo**, para no revelar quién está registrado (si ya existía, se avisa al dueño por correo).',
    requestBody: cuerpo({ correo, clave }, ['correo', 'clave'], { correo: 'ana@ejemplo.com', clave: 'una-clave-larga-1' }),
    responses: { 200: ok('Registro recibido', 'Si el correo es válido, te enviamos un mensaje para confirmarlo. Revisa tu bandeja.'), 400: r400 },
  } },
  '/usuarios/verificar': { post: {
    tags: ['Usuarios'], summary: 'Confirmar el correo con el código del enlace',
    description: 'El código sirve **una sola vez** y vence a las 24 horas. Es POST (no GET) para que los escáneres de correo que abren enlaces no lo gasten.',
    requestBody: cuerpo({ token }, ['token'], { token: 'A'.repeat(43) }),
    responses: { 200: ok('Correo confirmado', 'Correo confirmado. Ya puedes usar todas las funciones de tu cuenta.'), 400: json('Enlace inválido o vencido', errorRef) },
  } },
  '/usuarios/reenviar-verificacion': { post: {
    tags: ['Usuarios'], summary: 'Pedir otro enlace de confirmación',
    description: 'El enlace nuevo reemplaza al anterior. Respuesta idéntica exista o no la cuenta.',
    requestBody: cuerpo({ correo }, ['correo'], { correo: 'ana@ejemplo.com' }),
    responses: { 200: ok('Solicitud recibida', 'Si la cuenta existe y falta confirmarla, te enviamos un nuevo mensaje.'), 400: r400 },
  } },
  '/usuarios/ingresar': { post: {
    tags: ['Usuarios'], summary: 'Iniciar sesión',
    description: 'Si los datos son correctos, entrega la sesión en una cookie `httpOnly` (`SameSite=Strict`, y `Secure` en producción). Tras 5 intentos fallidos la cuenta se bloquea 15 minutos (429).',
    requestBody: cuerpo({ correo, clave: { type: 'string', maxLength: 128, example: 'una-clave-larga-1' } }, ['correo', 'clave'], { correo: 'ana@ejemplo.com', clave: 'una-clave-larga-1' }),
    responses: {
      200: json('Sesión iniciada (cabecera Set-Cookie)', { type: 'object', properties: { usuario: usuarioRef } },
        { usuario: { id: 12, correo: 'ana@ejemplo.com', rol: 'registrado', verificado: true, creadoEn: '2026-10-31T12:00:00.000Z' } }),
      400: r400, 401: r401, 429: json('Cuenta bloqueada temporalmente', errorRef),
    },
  } },
  '/usuarios/salir': { post: {
    tags: ['Usuarios'], summary: 'Cerrar sesión',
    description: 'Borra la cookie de sesión en este navegador. Siempre responde 200.',
    responses: { 200: ok('Sesión cerrada', 'Sesión cerrada') },
  } },
  '/usuarios/yo': {
    get: {
      tags: ['Usuarios'], summary: 'Datos de mi cuenta', security: protegida,
      responses: { 200: json('Usuario en sesión', { type: 'object', properties: { usuario: usuarioRef } }, { usuario: { id: 12, correo: 'ana@ejemplo.com', rol: 'registrado', verificado: false, creadoEn: '2026-10-31T12:00:00.000Z' } }), 401: r401 },
    },
    delete: {
      tags: ['Usuarios'], summary: 'Eliminar mi cuenta', security: protegida,
      description: 'Borra la cuenta y sus datos de forma definitiva. Pide la contraseña como confirmación.',
      requestBody: cuerpo({ clave: { type: 'string', maxLength: 128 } }, ['clave'], { clave: 'una-clave-larga-1' }),
      responses: { 200: ok('Cuenta eliminada', 'Tu cuenta y tus datos fueron eliminados.'), 400: r400, 401: r401, 403: r403 },
    },
  },
  '/usuarios/cambiar-clave': { post: {
    tags: ['Usuarios'], summary: 'Cambiar mi contraseña', security: protegida,
    description: 'Pide la contraseña actual. Cierra todas las demás sesiones abiertas y mantiene la actual.',
    requestBody: cuerpo({ claveActual: { type: 'string', maxLength: 128 }, claveNueva: clave }, ['claveActual', 'claveNueva'], { claveActual: 'una-clave-larga-1', claveNueva: 'otra-clave-larga-2' }),
    responses: { 200: ok('Contraseña cambiada', 'Contraseña cambiada. Las demás sesiones se cerraron.'), 400: r400, 401: r401, 403: r403 },
  } },
  '/usuarios/recuperar': { post: {
    tags: ['Usuarios'], summary: 'Pedir enlace para recuperar la contraseña',
    description: 'Envía un enlace que vale 60 minutos y sirve una sola vez. Respuesta idéntica exista o no la cuenta.',
    requestBody: cuerpo({ correo }, ['correo'], { correo: 'ana@ejemplo.com' }),
    responses: { 200: ok('Solicitud recibida', 'Si la cuenta existe, te enviamos un mensaje con los pasos para elegir una contraseña nueva.'), 400: r400 },
  } },
  '/usuarios/restablecer': { post: {
    tags: ['Usuarios'], summary: 'Elegir contraseña nueva con el código del enlace',
    description: 'Cierra todas las sesiones abiertas y da por confirmado el correo (el enlace llegó a esa bandeja). No inicia sesión: hay que ingresar con la contraseña nueva.',
    requestBody: cuerpo({ token, clave }, ['token', 'clave'], { token: 'A'.repeat(43), clave: 'otra-clave-larga-2' }),
    responses: { 200: ok('Contraseña actualizada', 'Contraseña actualizada. Ingresa con la nueva.'), 400: json('Datos inválidos o enlace vencido', errorRef) },
  } },
};
