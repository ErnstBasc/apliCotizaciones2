// Mailer real: envía por SMTP (Gmail u otro proveedor). Cumple el mismo contrato que el de consola: enviar({ para, asunto, texto }).
// El "transporte" (la librería que habla SMTP) se recibe de afuera: así se puede probar sin red ni cuenta real.
function crearMailerSmtp({ transporte, remitente }) {
  return {
    nombre: 'smtp',
    async enviar({ para, asunto, texto }) {
      await transporte.sendMail({ from: remitente, to: para, subject: asunto, text: texto });
    },
    // Comprueba host, puerto y credenciales sin enviar nada (lo usa el notificador al arrancar)
    async verificar() {
      await transporte.verify();
    },
  };
}

// Transporte real con nodemailer. Se carga solo si MAIL_MODO=smtp, para que sin esa opción no haga falta instalarlo.
function crearTransporteNodemailer({ host, port, seguro, usuario, clave }) {
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({ host, port, secure: seguro, auth: { user: usuario, pass: clave } });
}

module.exports = { crearMailerSmtp, crearTransporteNodemailer };
