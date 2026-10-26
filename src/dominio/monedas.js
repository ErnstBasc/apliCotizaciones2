// Constantes del dominio compartidas por adaptadores, cálculos y validación.
const MONEDAS_EXTERNAS = ['EUR', 'CLP', 'ARS', 'PEN', 'BRL', 'PYG']; // vienen de Frankfurter, "1 USD = X"
const MONEDAS_SOPORTADAS = ['USD', 'BOB', ...MONEDAS_EXTERNAS];     // las que acepta el conversor
const TASAS_BOB = ['oficial', 'paralelo'];
const LADOS = ['venta', 'compra'];

module.exports = { MONEDAS_EXTERNAS, MONEDAS_SOPORTADAS, TASAS_BOB, LADOS };
