const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { crearLimitador, crearLimitadores, LIMITES } = require('../src/middleware/limitador');
const { crearCabecerasSeguridad, CSP_PAGINA, CSP_DOCS } = require('../src/middleware/cabeceras');
const { crearRutasUsuarios } = require('../src/routes/usuarios');
const { cargarConfig } = require('../src/config');

const RAIZ = path.join(__dirname, '..');
function res() { const r = { cab: {} }; r.setHeader = (k, v) => { r.cab[k] = v; }; return r; }
function pasar(mw, req) { const r = res(); let error; mw(req, r, (e) => { error = e; }); return { r, error }; }

// ---------- limitador ----------
test('limitador: permite hasta el máximo, bloquea el siguiente con 429 y Retry-After, y cuenta cada IP por separado', () => {
  let ahora = 1_000_000;
  const l = crearLimitador({ ventanaMs: 60_000, maximo: 3, reloj: () => ahora });
  for (let i = 0; i < 3; i++) assert.strictEqual(pasar(l, { ip: '1.1.1.1' }).error, undefined);
  const cuarta = pasar(l, { ip: '1.1.1.1' });
  assert.strictEqual(cuarta.error.estado, 429);
  assert.strictEqual(cuarta.r.cab['Retry-After'], '60');
  assert.strictEqual(cuarta.r.cab['RateLimit-Remaining'], '0');
  assert.strictEqual(pasar(l, { ip: '2.2.2.2' }).error, undefined); // otra IP no se ve afectada
});

test('limitador: la ventana se reinicia al vencer; Retry-After baja con el tiempo', () => {
  let ahora = 0;
  const l = crearLimitador({ ventanaMs: 60_000, maximo: 1, reloj: () => ahora });
  pasar(l, { ip: 'a' });
  ahora = 45_000;
  assert.strictEqual(pasar(l, { ip: 'a' }).r.cab['Retry-After'], '15');
  ahora = 60_000;
  assert.strictEqual(pasar(l, { ip: 'a' }).error, undefined);
});

test('limitador: sin clave (por ejemplo petición sin correo) no cuenta ni bloquea; la clave puede ser el correo del cuerpo', () => {
  const ls = crearLimitadores();
  assert.strictEqual(pasar(ls.porCorreo, { body: {} }).error, undefined);
  assert.strictEqual(pasar(ls.porCorreo, { body: { correo: 5 } }).error, undefined);
  for (let i = 0; i < LIMITES.porCorreo.maximo; i++) assert.strictEqual(pasar(ls.porCorreo, { body: { correo: 'Ana@Ejemplo.com ' }, ip: `9.9.9.${i}` }).error, undefined);
  // mismo destinatario (aunque se escriba distinto y venga de otra IP): bloqueado
  assert.strictEqual(pasar(ls.porCorreo, { body: { correo: 'ana@ejemplo.com' }, ip: '8.8.8.8' }).error.estado, 429);
});

test('limitador: la memoria tiene tope (no crece sin límite con miles de IPs distintas)', () => {
  const l = crearLimitador({ ventanaMs: 3_600_000, maximo: 5 });
  for (let i = 0; i < 12_000; i++) pasar(l, { ip: `ip-${i}` });
  assert.ok(l.tamano() <= 10_000, `tamaño ${l.tamano()}`);
});

test('crearLimitadores: desactivados devuelve null; los de correo son mucho más estrictos que el general', () => {
  assert.strictEqual(crearLimitadores({ activo: false }), null);
  assert.ok(LIMITES.correos.maximo < LIMITES.ingreso.maximo && LIMITES.ingreso.maximo < LIMITES.general.maximo);
});

test('rutas de usuarios: registro, recuperación y reenvío llevan límite por IP y por correo; ingreso, el suyo; sin límites no cambian', () => {
  const montar = (limites) => {
    const rutas = {};
    const router = { use() {}, get: (p, ...f) => { rutas[`GET ${p}`] = f; }, post: (p, ...f) => { rutas[`POST ${p}`] = f; }, delete: (p, ...f) => { rutas[`DELETE ${p}`] = f; } };
    crearRutasUsuarios({ Router: () => router }, { usuarios: {}, sesiones: {}, autenticacion: { exigirSesion() {} }, mismoOrigen() {}, limites });
    return rutas;
  };
  const ls = crearLimitadores();
  const con = montar(ls);
  for (const r of ['POST /registro', 'POST /recuperar', 'POST /reenviar-verificacion']) {
    assert.strictEqual(con[r][0], ls.correos, r); assert.strictEqual(con[r][1], ls.porCorreo, r); assert.strictEqual(con[r].length, 3);
  }
  assert.strictEqual(con['POST /ingresar'][0], ls.ingreso);
  assert.strictEqual(con['POST /verificar'][0], ls.enlaces);
  assert.strictEqual(con['POST /restablecer'][0], ls.enlaces);
  const sin = montar(null);
  assert.strictEqual(sin['POST /registro'].length, 1);
  assert.strictEqual(sin['POST /ingresar'].length, 1);
});

// ---------- cabeceras ----------
test('cabeceras: política de contenido estricta para la página, relajada solo en /docs; HSTS solo con HTTPS', () => {
  const mw = crearCabecerasSeguridad();
  const pagina = pasar(mw, { path: '/' }).r.cab;
  assert.strictEqual(pagina['Content-Security-Policy'], CSP_PAGINA);
  assert.ok(!/unsafe-inline|unsafe-eval/.test(CSP_PAGINA));
  assert.match(CSP_PAGINA, /script-src 'self'(;|$)/);
  assert.match(CSP_PAGINA, /frame-ancestors 'none'/);
  assert.strictEqual(pagina['X-Content-Type-Options'], 'nosniff');
  assert.strictEqual(pagina['Referrer-Policy'], 'no-referrer');
  assert.strictEqual(pagina['X-Frame-Options'], 'DENY');
  assert.strictEqual(pagina['Strict-Transport-Security'], undefined);
  for (const ruta of ['/docs', '/docs/', '/docs/swagger-ui.css']) assert.strictEqual(pasar(mw, { path: ruta }).r.cab['Content-Security-Policy'], CSP_DOCS, ruta);
  assert.strictEqual(pasar(mw, { path: '/documentos' }).r.cab['Content-Security-Policy'], CSP_PAGINA);
  assert.match(pasar(crearCabecerasSeguridad({ https: true }), { path: '/' }).r.cab['Strict-Transport-Security'], /max-age=\d+/);
});

test('la página es compatible con su propia política de contenido: sin scripts ni estilos en línea y sin recursos de terceros no permitidos', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'hay un <script> en línea');
  assert.ok(!/<style[\s>]/i.test(html), 'hay un <style> en línea');
  assert.ok(!/\sstyle\s*=/i.test(html), 'hay un atributo style en línea');
  assert.ok(!/\son[a-z]+\s*=/i.test(html), 'hay un manejador de evento en línea');
  assert.ok(html.includes('src="/vendor/chart.umd.js"'));
  assert.ok(!html.includes('cdn.jsdelivr.net'));
  const externos = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => new URL(m[1]).host);
  for (const host of externos) assert.ok(['fonts.googleapis.com', 'fonts.gstatic.com'].includes(host), `recurso externo no permitido: ${host}`);
  // el código del navegador tampoco pone estilos en línea por atributo
  for (const f of fs.readdirSync(path.join(RAIZ, 'public', 'js', 'vistas'))) {
    const js = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'vistas', f), 'utf8');
    assert.ok(!/setAttribute\(\s*['"]style['"]|innerHTML\s*=|\bstyle:\s*[`'"]/.test(js), `${f} usa estilo en línea (atributo style) o innerHTML`);
  }
});

// ---------- usuario de base de datos con privilegios mínimos ----------
test('el script del usuario mínimo cubre TODAS las tablas del esquema y no da más permisos de los necesarios', () => {
  const esquema = fs.readFileSync(path.join(RAIZ, 'db', 'schema.sql'), 'utf8');
  const sql = fs.readFileSync(path.join(RAIZ, 'db', 'seguridad_usuario_app.sql'), 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const tablas = [...esquema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  assert.ok(tablas.length >= 7);
  for (const t of tablas) assert.match(sql, new RegExp(`GRANT [A-Z, ]+ ON [\\w, ]*\\b${t}\\b[\\w, ]* TO aplicotizaciones_app`), `la tabla ${t} no tiene permisos`);
  assert.match(sql, /NOSUPERUSER NOCREATEDB NOCREATEROLE/);
  assert.ok(!/ALL PRIVILEGES|GRANT ALL|TRUNCATE|REFERENCES|CREATE\s+ON/.test(sql), 'permisos de más');
  assert.match(sql, /GRANT SELECT, INSERT ON cotizaciones /); // las lecturas guardadas no se modifican ni se borran
  for (const secuencia of ['cotizaciones_id_seq', 'usuarios_id_seq', 'tokens_usuario_id_seq', 'alertas_id_seq', 'avisos_enviados_id_seq']) assert.ok(sql.includes(secuencia));
});

// ---------- configuración ----------
test('config de seguridad: límites activos por defecto; "off" no se permite en producción; proxies confiables', () => {
  assert.deepStrictEqual(cargarConfig({}).seguridad, { limiteActivo: true, proxiesConfiables: 0 });
  assert.strictEqual(cargarConfig({ RATE_LIMIT: 'off' }).seguridad.limiteActivo, false);
  assert.throws(() => cargarConfig({ RATE_LIMIT: 'off', NODE_ENV: 'production', JWT_SECRET: 'k'.repeat(32) }), /producción/);
  assert.throws(() => cargarConfig({ RATE_LIMIT: 'tal vez' }), /"on" u "off"/);
  assert.strictEqual(cargarConfig({ TRUST_PROXY: '1' }).seguridad.proxiesConfiables, 1);
  assert.strictEqual(cargarConfig({ TRUST_PROXY: 'x' }).seguridad.proxiesConfiables, 0);
});
