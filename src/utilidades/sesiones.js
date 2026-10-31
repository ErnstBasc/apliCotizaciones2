// Sesión = un JWT dentro de una cookie httpOnly. Esta pieza sabe emitirla, leerla y borrarla.
// La carga lleva solo: sub (id del usuario) y sv (versión de sesión). Cambiar o restablecer la contraseña sube
// la versión en la base y así TODAS las sesiones anteriores quedan invalidadas.
const jwt = require('./jwt');
const cookies = require('./cookies');

function crearSesiones({ secreto, duracionDias = 7, segura = false, reloj = () => Date.now() }) {
  if (!secreto || secreto.length < 32) throw new Error('El secreto de sesión debe tener al menos 32 caracteres');
  const duracionS = Math.round(duracionDias * 86400);
  // El prefijo __Host- obliga al navegador a exigir Secure, Path=/ y ningún Domain: más difícil de falsificar.
  const nombre = segura ? '__Host-sesion' : 'sesion';
  const opciones = { secure: segura, sameSite: 'Strict', httpOnly: true };

  return {
    nombre,
    emitir(res, usuario) {
      const token = jwt.firmar({ sub: usuario.id, sv: usuario.versionSesion }, secreto, { ahoraS: Math.floor(reloj() / 1000), duracionS });
      res.setHeader('Set-Cookie', cookies.serializar(nombre, token, { ...opciones, maxAgeS: duracionS }));
    },
    leer(req) {
      const token = cookies.leer(req.headers && req.headers.cookie)[nombre];
      return token ? jwt.verificar(token, secreto, { ahoraS: Math.floor(reloj() / 1000) }) : null;
    },
    limpiar(res) {
      res.setHeader('Set-Cookie', cookies.serializar(nombre, '', { ...opciones, maxAgeS: 0 }));
    },
  };
}

module.exports = { crearSesiones };
