// Constantes del histórico compartidas por la validación, el servicio y la documentación.
// Cada serie dice de qué instrumento y entidad se lee el valor de cada día.
const SERIES = {
  oficial: { instrumento: 'BOB_OFICIAL', entidad: 'bcb' },
  paralelo: { instrumento: 'BOB_PARALELO', entidad: 'binance' },
};
const SELECCIONES = ['oficial', 'paralelo', 'ambos'];
const DIAS_PERMITIDOS = [7, 30, 90, 180]; // 7 días, 1 mes, 3 meses, 6 meses

const FORMATOS_CSV = ['excel', 'estandar'];

module.exports = { SERIES, SELECCIONES, DIAS_PERMITIDOS, FORMATOS_CSV };
