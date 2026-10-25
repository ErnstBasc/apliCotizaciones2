// Prueba de envío de correo. Sin SMTP configurado solo imprime el aviso en consola.
// Con SMTP: npm install nodemailer   y define SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CORREO_PRUEBA.
(async () => {
  const para = process.env.CORREO_PRUEBA;
  const asunto = 'apliCotizaciones · prueba de aviso';
  const cuerpo = '1 USD = 11,68 BOB (oficial). Esto es una prueba del canal de avisos.';
  if (!process.env.SMTP_HOST || !para) {
    console.log('[consola] Para:', para || '(sin destinatario)');
    console.log('[consola] Asunto:', asunto, '\n[consola]', cuerpo);
    console.log('\nSin SMTP_HOST/CORREO_PRUEBA solo se simuló. Esto ya sirve para la demostración.');
    return;
  }
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  try {
    const info = await t.sendMail({ from: process.env.SMTP_USER, to: para, subject: asunto, text: cuerpo });
    console.log('Enviado:', info.messageId);
  } catch (e) { console.log('Falló el envío:', e.message); }
})();
