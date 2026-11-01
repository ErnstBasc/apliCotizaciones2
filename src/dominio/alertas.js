// Reglas puras de las alertas: qué tipos hay, cómo se describen y cuándo se cumplen. Sin base de datos ni correo.
const SERIES_ALERTA = ['oficial', 'paralelo'];
const LADOS = ['venta', 'compra'];
const TIPOS = ['sube_de', 'baja_de', 'cambio_pct'];
// Rangos razonables del umbral (Bs por USD para sube_de/baja_de; % para cambio_pct)
const LIMITES_UMBRAL = { precio: { min: 0.01, max: 1000 }, porcentaje: { min: 0.1, max: 50 } };

const NOMBRES = { oficial: 'oficial', paralelo: 'paralelo' };
const coma = (n) => n.toFixed(2).replace('.', ',');

function describir({ serie, lado, tipo, umbral }) {
  const que = `El dólar ${NOMBRES[serie]}${serie === 'paralelo' ? ` (${lado})` : ''}`;
  if (tipo === 'sube_de') return `${que} sube de ${coma(umbral)} Bs`;
  if (tipo === 'baja_de') return `${que} baja de ${coma(umbral)} Bs`;
  return `${que} cambia más de ${coma(umbral)} % en un día`;
}

// actual: valor ahora · cierreAnterior: último valor del día anterior (o null si no hay dato)
// Devuelve { cumple, cambioPct } (cambioPct solo para el tipo cambio_pct)
function evaluar({ tipo, umbral }, { actual, cierreAnterior }) {
  if (!Number.isFinite(actual)) return { cumple: false };
  if (tipo === 'sube_de') return { cumple: actual >= umbral };
  if (tipo === 'baja_de') return { cumple: actual <= umbral };
  if (!Number.isFinite(cierreAnterior) || cierreAnterior <= 0) return { cumple: false };
  const cambioPct = ((actual - cierreAnterior) / cierreAnterior) * 100;
  return { cumple: Math.abs(cambioPct) >= umbral, cambioPct };
}

module.exports = { SERIES_ALERTA, LADOS, TIPOS, LIMITES_UMBRAL, describir, evaluar, coma };
