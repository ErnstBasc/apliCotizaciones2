// Prueba del correo con TU configuración real (.env), sin tocar usuarios ni alertas:
//   1) verifica la conexión y las credenciales SMTP; 2) envía un mensaje de prueba.
// Uso:  npm run correo:prueba -- destino@ejemplo.com      (sin destino, se envía a SMTP_USUARIO)
require('dotenv').config();
const { cargarConfig } = require('../src/config');
const { crearMailer } = require('../src/composicion');

async function main() {
  const config = cargarConfig();
  const mailer = crearMailer(config);
  const destino = process.argv[2] || config.correo.smtp.usuario;
  console.log(`Modo de correo: ${mailer.nombre}`);
  if (mailer.nombre === 'consola') {
    console.log('MAIL_MODO=consola: el mensaje solo se imprimirá aquí. Para probar el envío real pon MAIL_MODO=smtp en .env.\n');
  }
  if (!destino) throw new Error('Indica un destinatario: npm run correo:prueba -- tu_correo@gmail.com');
  if (mailer.verificar) {
    await mailer.verificar();
    console.log('Conexión y credenciales SMTP: correctas.');
  }
  await mailer.enviar({
    para: destino,
    asunto: 'Prueba de apliCotizaciones',
    texto: `Si lees esto, el envío de correos funciona.\nEnviado el ${new Date().toLocaleString('es-BO')}.`,
  });
  console.log(`Mensaje de prueba enviado a ${destino}. Revisa la bandeja (y la carpeta de spam).`);
}

main().catch((err) => {
  console.error(`\nNo se pudo: ${err.message}`);
  if (/Invalid login|535|Username and Password not accepted/i.test(err.message)) {
    console.error('Pista: con Gmail hay que usar una "contraseña de aplicación" de 16 letras (requiere verificación en dos pasos), no tu contraseña normal.');
  }
  process.exit(1);
});
