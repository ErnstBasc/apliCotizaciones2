// Rutas de cuentas. Todas bajo /usuarios. La sesión viaja en una cookie httpOnly (el JavaScript de la página no la ve).
const v = require('./validacion');

// Respuesta a las peticiones "sin sesión": nunca se cachean
const sinCache = (res) => res.setHeader('Cache-Control', 'no-store');

const manejadores = (usuarios, sesiones) => ({
  registro: async (req, res, next) => {
    try { sinCache(res); res.json(await usuarios.registrar(v.validarRegistro(req.body))); } catch (e) { next(e); }
  },
  reenviar: async (req, res, next) => {
    try { sinCache(res); res.json(await usuarios.reenviarVerificacion(v.validarCorreo(req.body))); } catch (e) { next(e); }
  },
  verificar: async (req, res, next) => {
    try { sinCache(res); res.json(await usuarios.verificar(v.validarToken(req.body))); } catch (e) { next(e); }
  },
  ingresar: async (req, res, next) => {
    try {
      sinCache(res);
      const entrante = await usuarios.ingresar(v.validarIngreso(req.body));
      sesiones.emitir(res, entrante);
      const { versionSesion, ...usuario } = entrante;
      res.json({ usuario });
    } catch (e) { next(e); }
  },
  salir: (req, res) => { sinCache(res); sesiones.limpiar(res); res.json({ mensaje: 'Sesión cerrada' }); },
  yo: (req, res) => { sinCache(res); const { versionSesion, ...usuario } = req.usuario; res.json({ usuario }); },
  recuperar: async (req, res, next) => {
    try { sinCache(res); res.json(await usuarios.solicitarRecuperacion(v.validarCorreo(req.body))); } catch (e) { next(e); }
  },
  restablecer: async (req, res, next) => {
    try { sinCache(res); res.json(await usuarios.restablecer(v.validarRestablecer(req.body))); } catch (e) { next(e); }
  },
  cambiarClave: async (req, res, next) => {
    try {
      sinCache(res);
      const datos = v.validarCambioClave(req.body);
      const actualizado = await usuarios.cambiarClave({ usuarioId: req.usuario.id, ...datos });
      sesiones.emitir(res, actualizado); // esta sesión sigue abierta; las demás quedan cerradas
      res.json({ mensaje: 'Contraseña cambiada. Las demás sesiones se cerraron.' });
    } catch (e) { next(e); }
  },
  eliminar: async (req, res, next) => {
    try {
      sinCache(res);
      const r = await usuarios.eliminarCuenta({ usuarioId: req.usuario.id, ...v.validarEliminacion(req.body) });
      sesiones.limpiar(res);
      res.json(r);
    } catch (e) { next(e); }
  },
});

function crearRutasUsuarios(express, { usuarios, sesiones, autenticacion, mismoOrigen }) {
  const h = manejadores(usuarios, sesiones);
  const r = express.Router();
  r.use(mismoOrigen);
  r.post('/registro', h.registro);
  r.post('/reenviar-verificacion', h.reenviar);
  r.post('/verificar', h.verificar);
  r.post('/ingresar', h.ingresar);
  r.post('/salir', h.salir);
  r.post('/recuperar', h.recuperar);
  r.post('/restablecer', h.restablecer);
  r.get('/yo', autenticacion.exigirSesion, h.yo);
  r.post('/cambiar-clave', autenticacion.exigirSesion, h.cambiarClave);
  r.delete('/yo', autenticacion.exigirSesion, h.eliminar);
  return r;
}

module.exports = { crearRutasUsuarios, manejadoresUsuarios: manejadores };
