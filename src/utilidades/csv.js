// Armado de archivos CSV (texto separado por comas). Sin dependencias.
// Dos formatos, porque Excel en español entiende "1;5" y no "1,5":
//   estandar → separador "," y decimales con punto (para Python, R, Google Sheets, bases de datos…)
//   excel    → separador ";" y decimales con coma, más la marca BOM para que Excel respete las tildes (UTF-8)
const FORMATOS = {
  estandar: { separador: ',', decimal: '.', bom: '' },
  excel: { separador: ';', decimal: ',', bom: '﻿' },
};

function celda(valor, formato) {
  if (valor === null || valor === undefined) return '';
  const texto = typeof valor === 'number' ? String(valor).replace('.', formato.decimal) : String(valor);
  // Se entrecomilla si hay el separador DE ESE FORMATO, comillas o saltos de línea; las comillas internas se duplican (regla del CSV)
  return texto.includes(formato.separador) || /["\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// encabezados: ['fecha', 'oficial'] · filas: [['2026-10-30', 12.09], …] · devuelve el texto completo (líneas CRLF)
function aCsv(encabezados, filas, nombreFormato = 'estandar') {
  const formato = FORMATOS[nombreFormato];
  if (!formato) throw new Error(`Formato CSV desconocido: ${nombreFormato}`);
  const lineas = [encabezados, ...filas].map((f) => f.map((v) => celda(v, formato)).join(formato.separador));
  return formato.bom + lineas.join('\r\n') + '\r\n';
}

module.exports = { aCsv, FORMATOS };
