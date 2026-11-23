// Rutas de artículos: /articulos
//   GET /articulos      → público: títulos y resúmenes (nunca el cuerpo)
//   GET /articulos/:id  → texto completo: exige sesión y rol premium (o admin). Un usuario común recibe 403.
const v = require('./validacion');
const { ROLES_LECTORES } = require('../services/articulosService');

const MENSAJE_PREMIUM = 'Contenido para suscriptores premium';

const manejadores = (articulos) => ({
  listar: async (req, res, next) => {
    try { res.json(await articulos.listar()); } catch (e) { next(e); }
  },
  leer: async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'private, no-store'); // contenido pagado: que no quede en cachés compartidas
      res.json(await articulos.leer(v.validarIdArticulo(req.params)));
    } catch (e) { next(e); }
  },
});

function crearRutasArticulos(express, { articulos, autenticacion }) {
  const h = manejadores(articulos);
  const r = express.Router();
  r.get('/', h.listar);
  r.get('/:id', autenticacion.exigirSesion, autenticacion.exigirRol(ROLES_LECTORES, MENSAJE_PREMIUM), h.leer);
  return r;
}

module.exports = { crearRutasArticulos, manejadoresArticulos: manejadores, MENSAJE_PREMIUM };
