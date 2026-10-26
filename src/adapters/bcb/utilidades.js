// Utilidades de lectura de texto del BCB (formato boliviano: 3.992,83 → miles con punto, decimales con coma).
const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function numeroBoliviano(texto) {
  return Number(texto.replace(/\./g, '').replace(',', '.'));
}

// Última fecha "DD DE MES, AAAA" que aparezca en el trozo (o null)
function ultimaFecha(trozo) {
  let fecha = null;
  for (const f of trozo.matchAll(/(\d{1,2}) DE ([A-Za-zÁÉÍÓÚáéíóú]+),? (\d{4})/gi)) {
    const mes = MESES[f[2].toLowerCase()];
    if (mes) fecha = `${f[3]}-${String(mes).padStart(2, '0')}-${f[1].padStart(2, '0')}`;
  }
  return fecha;
}

// Fecha "DD de mes, AAAA" que aparece JUSTO antes de la posición dada (como encabezado de un bloque), o null.
function fechaEncabezado(texto, posicion, ventana = 40) {
  const previo = texto.slice(Math.max(0, posicion - ventana), posicion);
  const m = previo.match(/(\d{1,2}) DE ([A-Za-zÁÉÍÓÚáéíóú]+),? (\d{4})\s*$/i);
  const mes = m && MESES[m[2].toLowerCase()];
  return mes ? `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

// Último día del mes (AAAA-MM-DD) para un mes en español y un año: ('septiembre', 2026) → '2026-09-30'
function finDeMes(nombreMes, anio) {
  const mes = MESES[nombreMes.toLowerCase()];
  if (!mes) return null;
  const dia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

module.exports = { numeroBoliviano, ultimaFecha, fechaEncabezado, finDeMes, MESES };
