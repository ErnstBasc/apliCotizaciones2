// Inflación (IPC) en la portada del BCB.
// Texto real: "Indicadores de inflación En porcentaje septiembre de 2026 IPC (2016 = 100) 152,85 Mensual 0,85
// 12 meses 5,70 Más información"
// La fecha guardada es el último día del mes al que corresponde el dato.
const { numeroBoliviano, finDeMes } = require('./utilidades');

const NUM = '(-?\\d{1,3}(?:\\.\\d{3})*,\\d{1,2})';
const PATRON = new RegExp(
  `Indicadores de inflaci[oó]n\\s+En porcentaje\\s+([A-Za-zÁÉÍÓÚáéíóú]+) de (\\d{4})\\s+IPC\\s*\\(2016\\s*=\\s*100\\)\\s*${NUM}\\s+Mensual\\s+${NUM}\\s+12 meses\\s+${NUM}`,
  'i'
);

function extraerInflacion(texto) {
  const m = PATRON.exec(texto);
  if (!m) throw new Error('BCB: no se encontró la inflación (la portada cambió de formato)');
  const fecha = finDeMes(m[1], Number(m[2]));
  if (!fecha) throw new Error(`BCB: mes desconocido en inflación ("${m[1]}")`);
  const mensual = numeroBoliviano(m[4]);
  const doceMeses = numeroBoliviano(m[5]);
  if (!(mensual > -10 && mensual < 30)) throw new Error(`BCB: inflación mensual fuera de rango (${mensual})`);
  if (!(doceMeses > -20 && doceMeses < 200)) throw new Error(`BCB: inflación a 12 meses fuera de rango (${doceMeses})`);
  return { mensual, doceMeses, fecha };
}

module.exports = { extraerInflacion };
