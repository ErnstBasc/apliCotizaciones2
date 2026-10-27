// Formato de números y fechas al estilo boliviano: 3.992,83 (punto para miles, coma para decimales).
const L = 'es-BO';
const fmt = (min, max) => new Intl.NumberFormat(L, { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: 'always' });
const dos = fmt(2, 2);

export const bs = (n) => dos.format(n);
export const numero = (n) => (Math.abs(n) >= 100 ? fmt(0, 2) : fmt(0, 5)).format(n);
export const porcentaje = (n, conSigno = false) => `${conSigno && n > 0 ? '+' : ''}${dos.format(n)} %`;
export const hora = (fecha) => fecha.toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit' });
export const mesDe = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(L, { month: 'long', year: 'numeric' }) : null);
export const fechaCorta = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(L, { day: 'numeric', month: 'short' }) : null);

// Monedas de poco valor (ARS, PYG, CLP) se muestran por 10, 100 o 1.000 unidades para que el número sea legible.
export function multiplicadorLegible(valorEnBs) {
  for (const m of [1, 10, 100, 1000]) if (valorEnBs * m >= 1) return m;
  return 1000;
}

// Acepta "1.000,50", "25,5" o "25.5" y lo normaliza a "1000.50" / "25.5" (el servidor exige punto decimal)
export function normalizarMonto(texto) {
  const t = texto.trim().replace(/\s/g, '');
  return t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
}
