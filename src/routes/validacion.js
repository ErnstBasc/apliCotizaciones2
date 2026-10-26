// Validación de parámetros de entrada por LISTA BLANCA: solo se acepta lo que se espera, nada más.
const { ErrorValidacion } = require('../errores');
const { MONEDAS_SOPORTADAS, TASAS_BOB, LADOS } = require('../dominio/monedas');

// Un parámetro repetido (?monto=1&monto=2) llega como arreglo: se rechaza.
function texto(query, nombre, porDefecto) {
  const v = query[nombre];
  if (v === undefined) return porDefecto;
  if (typeof v !== 'string') throw new ErrorValidacion(`El parámetro "${nombre}" debe indicarse una sola vez`);
  return v;
}

function validarConversion(query) {
  const monto = texto(query, 'monto');
  if (monto === undefined || !/^\d{1,12}(\.\d{1,6})?$/.test(monto)) {
    throw new ErrorValidacion('El parámetro "monto" debe ser un número mayor o igual a 0, con punto decimal (ejemplo: 100 o 25.5)');
  }
  const de = (texto(query, 'de') ?? '').toUpperCase();
  const a = (texto(query, 'a') ?? '').toUpperCase();
  for (const [nombre, codigo] of [['de', de], ['a', a]]) {
    if (!MONEDAS_SOPORTADAS.includes(codigo)) {
      throw new ErrorValidacion(`Moneda no soportada en "${nombre}". Soportadas: ${MONEDAS_SOPORTADAS.join(', ')}`);
    }
  }
  const tasa = texto(query, 'tasa', 'oficial');
  if (!TASAS_BOB.includes(tasa)) throw new ErrorValidacion(`El parámetro "tasa" debe ser: ${TASAS_BOB.join(' o ')}`);
  const lado = texto(query, 'lado', 'venta');
  if (!LADOS.includes(lado)) throw new ErrorValidacion(`El parámetro "lado" debe ser: ${LADOS.join(' o ')}`);
  return { monto: Number(monto), de, a, tasa, lado };
}

module.exports = { validarConversion };
