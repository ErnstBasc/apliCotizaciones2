const test = require('node:test');
const assert = require('node:assert');
const { crearRevisorAlertas, crearTareaNotificador } = require('../src/services/notificador');
const { crearMailerSmtp } = require('../src/mailer/smtp');
const { crearMailer } = require('../src/composicion');
const { cargarConfig } = require('../src/config');

const AHORA = new Date('2026-11-01T16:00:00Z'); // 12:00 en La Paz
const obs = (instrumento, entidad, venta, compra, estado = 'vigente') => ({ instrumento, entidad, venta, compra, valor: venta, estado });

function montar({ alertas, precios, dias = [], fallaCorreo = false } = {}) {
  const estado = { enviados: [], reclamos: [], liberados: [], marcas: new Map(alertas.map((a) => [a.id, a.ultimoAvisoEn])) };
  const repoAlertas = {
    activasConCorreo: async () => alertas,
    reclamarAviso: async ({ id, ahora, esperaHasta }) => {
      const m = estado.marcas.get(id);
      if (m && m > esperaHasta) return false;
      estado.marcas.set(id, ahora); estado.reclamos.push(id); return true;
    },
    liberarAviso: async ({ id, anterior }) => { estado.marcas.set(id, anterior); estado.liberados.push(id); },
  };
  const consultasDias = [];
  const repoCotiz = {
    ultimas: async () => precios,
    ultimoPorDia: async (p) => { consultasDias.push(p); return dias; },
  };
  const mailer = { enviar: async (c) => { if (fallaCorreo) throw new Error('SMTP caído'); estado.enviados.push(c); } };
  const registros = [];
  const revisor = crearRevisorAlertas({
    alertas: repoAlertas, cotizaciones: repoCotiz, mailer, urlPublica: 'http://sitio.test', enfriamientoHoras: 12,
    ahora: () => AHORA, logger: { log() {}, error: (...a) => registros.push(a.join(' ')) },
  });
  return { revisor, estado, consultasDias, registros };
}
const alerta = (extra) => ({ id: 1, usuarioId: 1, correo: 'ana@ejemplo.com', serie: 'paralelo', lado: 'venta', tipo: 'sube_de', umbral: 12, activa: true, ultimoAvisoEn: null, ...extra });
const PRECIOS = [obs('BOB_PARALELO', 'binance', 12.3, 12.2), obs('BOB_OFICIAL', 'bcb', 12.09, 12.09)];

test('avisa cuando se cumple: correo al dueño con la descripción y el valor actual', async () => {
  const { revisor, estado } = montar({ alertas: [alerta()], precios: PRECIOS });
  const r = await revisor.revisar();
  assert.deepStrictEqual(r, { revisadas: 1, enviados: 1, fallidos: 0 });
  const c = estado.enviados[0];
  assert.strictEqual(c.para, 'ana@ejemplo.com');
  assert.match(c.asunto, /sube de 12,00 Bs/);
  assert.match(c.texto, /Valor actual: 12,30 Bs/);
  assert.match(c.texto, /12 horas/);
  assert.match(c.texto, /http:\/\/sitio\.test/);
});

test('no avisa si no se cumple, si falta el dato, o si el dato está desactualizado', async () => {
  for (const precios of [[obs('BOB_PARALELO', 'binance', 11.5, 11.4)], [], [obs('BOB_PARALELO', 'binance', 13, 12.9, 'desactualizado')], [obs('BOB_PARALELO', 'otro', 13, 12.9)]]) {
    const { revisor, estado } = montar({ alertas: [alerta()], precios });
    assert.strictEqual((await revisor.revisar()).enviados, 0);
    assert.strictEqual(estado.enviados.length, 0);
  }
});

test('respeta el tiempo de espera: a las 11 h no repite; a las 12 h sí; y reclama antes de enviar', async () => {
  const hace = (h) => new Date(AHORA - h * 3_600_000);
  const a = montar({ alertas: [alerta({ ultimoAvisoEn: hace(11) })], precios: PRECIOS });
  assert.strictEqual((await a.revisor.revisar()).enviados, 0);
  const b = montar({ alertas: [alerta({ ultimoAvisoEn: hace(12) })], precios: PRECIOS });
  assert.strictEqual((await b.revisor.revisar()).enviados, 1);
  assert.deepStrictEqual(b.estado.reclamos, [1]);
});

test('si otro proceso ya reclamó el aviso, no se envía dos veces', async () => {
  const { revisor, estado } = montar({ alertas: [alerta()], precios: PRECIOS });
  estado.marcas.set(1, AHORA); // otro proceso lo marcó justo antes
  assert.strictEqual((await revisor.revisar()).enviados, 0);
  assert.strictEqual(estado.enviados.length, 0);
});

test('si el correo falla: se devuelve la marca anterior (se reintenta luego), se cuenta el fallo y se registra', async () => {
  const { revisor, estado, registros } = montar({ alertas: [alerta()], precios: PRECIOS, fallaCorreo: true });
  const r = await revisor.revisar();
  assert.deepStrictEqual([r.enviados, r.fallidos], [0, 1]);
  assert.deepStrictEqual(estado.liberados, [1]);
  assert.strictEqual(estado.marcas.get(1), null);
  assert.ok(registros.some((l) => l.includes('SMTP caído')));
});

test('una alerta con problemas no detiene a las demás', async () => {
  const repo = { activasConCorreo: async () => [alerta({ id: 1 }), alerta({ id: 2, correo: 'otra@ejemplo.com' })], reclamarAviso: async () => true, liberarAviso: async () => {} };
  const enviados = [];
  const rev = crearRevisorAlertas({
    alertas: repo, cotizaciones: { ultimas: async () => PRECIOS, ultimoPorDia: async () => [] },
    mailer: { enviar: async (c) => { if (c.para === 'ana@ejemplo.com') throw new Error('rebotó'); enviados.push(c.para); } },
    urlPublica: 'x', enfriamientoHoras: 12, ahora: () => AHORA, logger: { log() {}, error() {} },
  });
  const r = await rev.revisar();
  assert.deepStrictEqual([r.enviados, r.fallidos], [1, 1]);
  assert.deepStrictEqual(enviados, ['otra@ejemplo.com']);
});

test('cambio porcentual: compara con el último cierre ANTERIOR a hoy y avisa con el % en el correo', async () => {
  const dias = [{ fecha: '2026-10-30', venta: 11.9, compra: 11.8 }, { fecha: '2026-10-31', venta: 12, compra: 11.9 }, { fecha: '2026-11-01', venta: 12.3, compra: 12.2 }];
  const { revisor, estado, consultasDias } = montar({ alertas: [alerta({ tipo: 'cambio_pct', umbral: 2 })], precios: PRECIOS, dias });
  assert.strictEqual((await revisor.revisar()).enviados, 1); // 12,30 vs 12,00 = +2,5 %
  assert.match(estado.enviados[0].texto, /\+2,50 %/);
  assert.match(estado.enviados[0].texto, /12,00 Bs/);
  assert.strictEqual(consultasDias[0].instrumento, 'BOB_PARALELO');
  assert.strictEqual(consultasDias[0].desde, '2026-10-25');
});

test('cambio porcentual: sin cierre anterior no avisa; la consulta se comparte entre alertas iguales', async () => {
  const a = montar({ alertas: [alerta({ tipo: 'cambio_pct', umbral: 1 })], precios: PRECIOS, dias: [] });
  assert.strictEqual((await a.revisor.revisar()).enviados, 0);
  const dias = [{ fecha: '2026-10-31', venta: 12, compra: 11.9 }];
  const b = montar({ alertas: [alerta({ id: 1, tipo: 'cambio_pct', umbral: 1 }), alerta({ id: 2, tipo: 'cambio_pct', umbral: 2, correo: 'z@z.co' })], precios: PRECIOS, dias });
  await b.revisor.revisar();
  assert.strictEqual(b.consultasDias.length, 1);
});

test('lado compra usa la compra; el oficial usa su valor único', async () => {
  const c = montar({ alertas: [alerta({ lado: 'compra', umbral: 12.2 })], precios: PRECIOS });
  assert.strictEqual((await c.revisor.revisar()).enviados, 1);
  const o = montar({ alertas: [alerta({ serie: 'oficial', lado: 'venta', tipo: 'baja_de', umbral: 12.1 })], precios: PRECIOS });
  assert.strictEqual((await o.revisor.revisar()).enviados, 1);
});

test('sin alertas activas no consulta precios; la tarea resume la vuelta', async () => {
  let consultado = false;
  const rev = crearRevisorAlertas({ alertas: { activasConCorreo: async () => [] }, cotizaciones: { ultimas: async () => { consultado = true; return []; } }, mailer: {}, urlPublica: 'x', enfriamientoHoras: 12, ahora: () => AHORA });
  assert.deepStrictEqual(await rev.revisar(), { revisadas: 0, enviados: 0, fallidos: 0 });
  assert.strictEqual(consultado, false);
  const tarea = crearTareaNotificador({ revisor: { revisar: async () => ({ revisadas: 4, enviados: 1, fallidos: 2 }) }, cadaMin: 5 });
  assert.strictEqual(tarea.cadaMin, 5);
  assert.match(await tarea.ejecutar(), /4 alerta\(s\) revisada\(s\), 1 aviso\(s\) enviado\(s\), 2 con error/);
});

// ---------- correo SMTP y configuración ----------
test('mailer SMTP: pasa remitente, destinatario, asunto y texto al transporte; verificar delega', async () => {
  const llamadas = [];
  const m = crearMailerSmtp({ transporte: { sendMail: async (x) => llamadas.push(x), verify: async () => llamadas.push('verify') }, remitente: 'App <a@b.co>' });
  await m.enviar({ para: 'ana@ejemplo.com', asunto: 'Hola', texto: 'Cuerpo' });
  await m.verificar();
  assert.deepStrictEqual(llamadas, [{ from: 'App <a@b.co>', to: 'ana@ejemplo.com', subject: 'Hola', text: 'Cuerpo' }, 'verify']);
});

test('crearMailer: consola por defecto; smtp arma el transporte con los datos del entorno', () => {
  assert.strictEqual(crearMailer(cargarConfig({})).nombre, 'consola');
  let recibido;
  const m = crearMailer(cargarConfig({ MAIL_MODO: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_USUARIO: 'yo@gmail.com', SMTP_CLAVE: 'abcd' }), {
    crearTransporte: (smtp) => { recibido = smtp; return { sendMail() {} }; },
  });
  assert.strictEqual(m.nombre, 'smtp');
  assert.deepStrictEqual(recibido, { host: 'smtp.gmail.com', port: 465, seguro: true, usuario: 'yo@gmail.com', clave: 'abcd' });
});

test('config de correo y alertas: valores por defecto, remitente a partir del usuario SMTP y errores claros', () => {
  const c = cargarConfig({});
  assert.deepStrictEqual(c.alertas, { maxPorUsuario: 3, enfriamientoHoras: 12 });
  assert.strictEqual(c.notificadorMin, 5);
  assert.strictEqual(cargarConfig({ ALERTAS_MAX: '5', ALERTAS_ENFRIAMIENTO_H: '6', NOTIFICADOR_MIN: '1' }).alertas.maxPorUsuario, 5);
  assert.strictEqual(cargarConfig({ ALERTAS_MAX: 'abc' }).alertas.maxPorUsuario, 3);
  assert.strictEqual(cargarConfig({ ALERTAS_MAX: '0' }).alertas.maxPorUsuario, 3);
  assert.throws(() => cargarConfig({ MAIL_MODO: 'smtp', SMTP_HOST: 'h' }), /SMTP_USUARIO, SMTP_CLAVE/);
  assert.throws(() => cargarConfig({ MAIL_MODO: 'paloma' }), /"consola" o "smtp"/);
  assert.strictEqual(cargarConfig({ MAIL_MODO: 'smtp', SMTP_HOST: 'h', SMTP_USUARIO: 'yo@gmail.com', SMTP_CLAVE: 'c' }).correo.remitente, 'apliCotizaciones <yo@gmail.com>');
});
