// CORS por lista blanca de orígenes. Es una política del NAVEGADOR: el servidor solo declara a qué páginas de
// OTRO origen les permite leer sus respuestas. Un origen = esquema + dominio + puerto (http://localhost:5500).
//   - Lista vacía (por defecto): no se envía ninguna cabecera CORS; el frontend va en el mismo origen y no la necesita.
//   - Con orígenes en CORS_ORIGINS: solo esos pueden leer la API desde el navegador. "*" permite a cualquiera (solo para APIs públicas).
// OJO: CORS NO protege al servidor (curl o Postman ignoran la política). Protege al USUARIO frente a páginas ajenas.
//
// Esta API solo lee (GET). En la Fase B (usuarios) se ampliarán los métodos y se aceptará la cabecera Authorization.
const { ErrorApp } = require('../errores');

const METODOS = 'GET, HEAD, OPTIONS';
const CABECERAS = 'Content-Type';
const TIEMPO_PREVUELO_S = '600';

function crearCors(origenesPermitidos = []) {
  const lista = new Set(origenesPermitidos);
  const cualquiera = lista.has('*');

  return function cors(req, res, next) {
    const origen = req.headers && req.headers.origin;
    if (!origen) return next(); // petición del mismo origen o de una herramienta (curl, Swagger en el mismo servidor)

    res.setHeader('Vary', 'Origin'); // las cachés deben distinguir respuestas según el origen
    const permitido = cualquiera || lista.has(origen);
    const esPrevuelo = req.method === 'OPTIONS' && req.headers['access-control-request-method'];

    if (!permitido) {
      // Se atiende igual, pero sin cabeceras CORS: el navegador impedirá que la página ajena lea la respuesta.
      return esPrevuelo ? next(new ErrorApp(403, 'Origen no permitido por CORS')) : next();
    }

    res.setHeader('Access-Control-Allow-Origin', cualquiera ? '*' : origen);
    if (esPrevuelo) {
      res.setHeader('Access-Control-Allow-Methods', METODOS);
      res.setHeader('Access-Control-Allow-Headers', CABECERAS);
      res.setHeader('Access-Control-Max-Age', TIEMPO_PREVUELO_S);
      return res.status(204).end();
    }
    return next();
  };
}

module.exports = { crearCors };
