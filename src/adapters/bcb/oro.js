// Precio del oro en la portada del BCB.
// Texto real: "… 2026 Oro USD./O.T.F. 3.992,83 Más información UFV Bs/UFV 3,36331 …"
// OJO: la palabra "Oro" también está en el menú ("Informe de Operaciones del Oro"), por eso el ancla es la
// secuencia completa "Oro USD./O.T.F.". O.T.F. = onza troy fina.
const { numeroBoliviano, fechaEncabezado } = require('./utilidades');

function extraerOro(texto) {
  const m = /Oro\s+USD\.?\/O\.T\.F\.?\s*(\d{1,3}(?:\.\d{3})*,\d{1,2})/i.exec(texto);
  if (!m) throw new Error('BCB: no se encontró el precio del oro (la portada cambió de formato)');
  const valor = numeroBoliviano(m[1]);
  if (!(valor > 500 && valor < 20_000)) throw new Error(`BCB: precio del oro fuera de rango (${valor})`);
  return { valor, fecha: fechaEncabezado(texto, m.index) };
}

module.exports = { extraerOro };
