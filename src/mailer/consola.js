// Envío de correos SIMULADO: en vez de mandar el mensaje, lo imprime en la consola del servidor.
// Sirve para desarrollar: el enlace de verificación o de recuperación se copia desde la terminal.
// Todo mailer cumple el mismo contrato: enviar({ para, asunto, texto }) → Promise. En la Etapa 6 se agrega uno SMTP real
// y solo cambia la línea de server.js que elige cuál usar.
function crearMailerConsola({ logger = console } = {}) {
  return {
    nombre: 'consola',
    async enviar({ para, asunto, texto }) {
      const linea = '─'.repeat(60);
      logger.log(`\n${linea}\n✉  CORREO SIMULADO (no se envió nada)\n   Para:   ${para}\n   Asunto: ${asunto}\n${linea}\n${texto}\n${linea}\n`);
    },
  };
}

module.exports = { crearMailerConsola };
