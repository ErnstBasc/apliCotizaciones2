// Rutas de alertas: /alertas. Todas exigen sesión y correo confirmado (se aplican una vez, en el router).
const v = require('./validacion');

const manejadores = (alertas) => ({
  listar: async (req, res, next) => {
    try { res.setHeader('Cache-Control', 'no-store'); res.json(await alertas.listar(req.usuario.id)); } catch (e) { next(e); }
  },
  crear: async (req, res, next) => {
    try { res.json({ alerta: await alertas.crear(req.usuario.id, v.validarAlerta(req.body)) }); } catch (e) { next(e); }
  },
  cambiar: async (req, res, next) => {
    try {
      const id = v.validarIdAlerta(req.params);
      res.json({ alerta: await alertas.cambiarActiva(req.usuario.id, id, v.validarActiva(req.body).activa) });
    } catch (e) { next(e); }
  },
  eliminar: async (req, res, next) => {
    try { res.json(await alertas.eliminar(req.usuario.id, v.validarIdAlerta(req.params))); } catch (e) { next(e); }
  },
});

function crearRutasAlertas(express, { alertas, autenticacion, mismoOrigen }) {
  const h = manejadores(alertas);
  const r = express.Router();
  r.use(mismoOrigen, autenticacion.exigirSesion, autenticacion.exigirVerificado);
  r.get('/', h.listar);
  r.post('/', h.crear);
  r.patch('/:id', h.cambiar);
  r.delete('/:id', h.eliminar);
  return r;
}

module.exports = { crearRutasAlertas, manejadoresAlertas: manejadores };
