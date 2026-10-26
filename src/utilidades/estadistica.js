// Estadística básica, sin dependencias. La mediana resiste anuncios "raros" (precios absurdos) mejor que el promedio.
function mediana(numeros) {
  if (!numeros.length) throw new Error('mediana: lista vacía');
  const s = [...numeros].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const redondear = (n, decimales = 4) => Number(n.toFixed(decimales));

module.exports = { mediana, redondear };
