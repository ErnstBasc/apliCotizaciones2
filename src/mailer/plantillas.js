// Textos de los correos (texto plano). Funciones puras: reciben datos y devuelven { asunto, texto }.
const pie = '\nSi no fuiste tú, ignora este mensaje: no se hará ningún cambio.\n— apliCotizaciones';

const correoVerificacion = ({ enlace, horas }) => ({
  asunto: 'Confirma tu correo en apliCotizaciones',
  texto: `Para activar tu cuenta, abre este enlace (vale ${horas} horas):\n\n${enlace}\n${pie}`,
});

const correoCuentaExistente = ({ urlPublica }) => ({
  asunto: 'Ya tienes una cuenta en apliCotizaciones',
  texto: `Alguien intentó registrar este correo, pero ya tiene una cuenta.\nSi eres tú, ingresa en ${urlPublica} y, si olvidaste tu contraseña, usa "Olvidé mi contraseña".\n${pie}`,
});

const correoRecuperacion = ({ enlace, minutos }) => ({
  asunto: 'Restablece tu contraseña de apliCotizaciones',
  texto: `Para elegir una contraseña nueva, abre este enlace (vale ${minutos} minutos y sirve una sola vez):\n\n${enlace}\n${pie}`,
});

const coma = (n) => Number(n).toFixed(2).replace('.', ',');

const correoAlerta = ({ descripcion, actual, cierre, cambioPct, urlPublica, horas }) => ({
  asunto: `Alerta de apliCotizaciones: ${descripcion}`,
  texto: `Se cumplió tu alerta: ${descripcion}.\n\n` +
    `Valor actual: ${coma(actual)} Bs por dólar.\n` +
    (cambioPct !== undefined ? `Cambio respecto al cierre anterior (${coma(cierre)} Bs): ${cambioPct > 0 ? '+' : ''}${coma(cambioPct)} %.\n` : '') +
    `\nNo volverás a recibir aviso de esta alerta durante ${horas} horas, aunque siga cumpliéndose.\n` +
    `Para pausarla, cambiarla o eliminarla, ingresa en ${urlPublica} y busca "Mis alertas".\n\n— apliCotizaciones`,
});

module.exports = { correoAlerta, correoVerificacion, correoCuentaExistente, correoRecuperacion };
