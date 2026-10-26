// UFV (Unidad de Fomento a la Vivienda) en la portada del BCB.
// Texto real: "… UFV Bs/UFV 3,36331 Más información Base monetaria en moneda nacional y UFV …"
// El ancla "UFV Bs/UFV" evita confundirla con la otra mención de UFV ("moneda nacional y UFV").
// La UFV comparte el encabezado de fecha con el oro (están en el mismo bloque de la portada).
const { numeroBoliviano, fechaEncabezado } = require('./utilidades');

function extraerUfv(texto) {
  const m = /UFV\s+Bs\/UFV\s*(\d{1,2},\d{3,6})/i.exec(texto);
  if (!m) throw new Error('BCB: no se encontró la UFV (la portada cambió de formato)');
  const valor = numeroBoliviano(m[1]);
  if (!(valor > 1 && valor < 20)) throw new Error(`BCB: UFV fuera de rango (${valor})`);
  // Fecha: la del encabezado que precede al bloque del oro (si existe)
  const oro = /Oro\s+USD\.?\/O\.T\.F/i.exec(texto);
  return { valor, fecha: oro ? fechaEncabezado(texto, oro.index) : null };
}

module.exports = { extraerUfv };
