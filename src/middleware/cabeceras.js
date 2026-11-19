// Cabeceras de seguridad HTTP (lo esencial de lo que hace la librería "helmet", escrito a mano para no sumar dependencias).
// Son instrucciones que el servidor le da al NAVEGADOR para que se proteja mejor.
//   Content-Security-Policy → lista blanca de dónde puede cargar scripts, estilos, fuentes… (frena inyección de scripts, XSS)
//   X-Content-Type-Options  → no "adivinar" el tipo de archivo
//   Referrer-Policy         → no revelar la dirección de origen (los enlaces de los correos llevan códigos)
//   frame-ancestors / X-Frame-Options → nadie puede incrustar esta página en un marco ajeno (clickjacking)
//   Strict-Transport-Security → (solo con HTTPS) el navegador exigirá HTTPS siempre
//   Permissions-Policy      → apaga cámara, micrófono, ubicación… que la página no usa
const CSP_PAGINA = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// Swagger UI inserta scripts y estilos en la propia página; en /docs (y solo allí) se permite eso, sin relajar el resto del sitio.
const CSP_DOCS = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

function crearCabecerasSeguridad({ https = false } = {}) {
  return function cabecerasSeguridad(req, res, next) {
    const esDocs = typeof req.path === 'string' && (req.path === '/docs' || req.path.startsWith('/docs/'));
    res.setHeader('Content-Security-Policy', esDocs ? CSP_DOCS : CSP_PAGINA);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (https) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  };
}

module.exports = { crearCabecerasSeguridad, CSP_PAGINA, CSP_DOCS };
