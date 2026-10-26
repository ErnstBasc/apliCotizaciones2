// Dólar oficial del BCB. Se lee con un "ancla" de texto: lo que sigue a "Tipo de cambio oficial".
// Texto real (25-oct-2026): "Tipo de cambio oficial Bolivianos por dólar estadounidense VIGENTE PARA EL
// SÁBADO 24, DOMINGO 25 Y LUNES 26 DE OCTUBRE, 2026 Bs --> 11,88 Más información"
// La fecha guardada es el ÚLTIMO día de vigencia que publica el BCB (el fin de semana vale hasta el lunes).
const { crearObservacion } = require('../../contracts/observacion');
const { numeroBoliviano, ultimaFecha } = require('./utilidades');

function extraerOficial(texto) {
  for (const m of texto.matchAll(/Tipo de cambio oficial(.{0,400})/gi)) {
    const trozo = m[1];
    const numero = trozo.match(/(\d{1,2},\d{2,4})/);
    if (!numero) continue; // este bloque no trae número (p. ej. un menú): probar el siguiente
    const valor = numeroBoliviano(numero[1]);
    if (!(valor > 1 && valor < 50)) continue; // control de cordura: descarta datos absurdos
    return { valor, fecha: ultimaFecha(trozo) };
  }
  throw new Error('BCB: no se pudo leer el tipo de cambio oficial (la portada cambió de formato)');
}

// "obtenerTexto" es una función async que devuelve el texto de la portada (ver portada.js)
function crearAdaptadorBcbOficial({ obtenerTexto }) {
  return {
    nombre: 'bcb',
    instrumentos: ['BOB_OFICIAL'],
    async obtener() {
      const { valor, fecha } = extraerOficial(await obtenerTexto());
      // El BCB publica un solo valor: se usa como venta y como compra.
      return [crearObservacion({
        instrumento: 'BOB_OFICIAL', entidad: 'bcb', valor, compra: valor, venta: valor, unidad: 'Bs por USD', fecha,
      })];
    },
  };
}

module.exports = { crearAdaptadorBcbOficial, extraerOficial };
