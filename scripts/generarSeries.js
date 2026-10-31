// Genera series FICTICIAS pero plausibles del dólar oficial y paralelo, para probar el histórico y el gráfico
// antes de tener datos reales. Función pura: sin base de datos, sin red; con la misma semilla da siempre lo mismo.
//
// Forma de las series (inspirada en lo que se ve en el mercado, pero inventada):
//  - Oficial: 6,96 fijo durante los primeros ~60 % del período y luego sube por escalones semanales hasta 12,09.
//  - Paralelo: tendencia de 9,9 a ~12,0 con ruido diario; 6 lecturas por día (cada 4 horas, hora de Bolivia),
//    con venta > compra por un margen de 0,04 a 0,08.
const { fechaBolivia } = require('../src/utilidades/fechas');

const MS_DIA = 86_400_000;
const HORAS_PARALELO = [0, 4, 8, 12, 16, 20];

// Generador pseudoaleatorio con semilla (mulberry32): reproducible, sin dependencias
function aleatorio(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dosDecimales = (n) => Math.round(n * 100) / 100;

// Instante UTC de una hora local de Bolivia (UTC-4) en una fecha 'AAAA-MM-DD'
const instante = (fecha, hora) => new Date(Date.parse(`${fecha}T00:00:00Z`) + (hora + 4) * 3_600_000);

// "hoy": instante de referencia. La serie termina AYER (hora de Bolivia), para no pisar los datos reales de hoy.
function generarSeries({ dias = 180, hoy = new Date(), semilla = 2026 } = {}) {
  if (!Number.isInteger(dias) || dias < 7 || dias > 730) throw new Error('dias debe ser un entero entre 7 y 730');
  const azar = aleatorio(semilla);
  const ayer = Date.parse(`${fechaBolivia(hoy)}T00:00:00Z`) - MS_DIA;
  const inicioSubida = Math.floor(dias * 0.6);
  const semanasDeSubida = Math.max(1, Math.ceil((dias - 10 - inicioSubida) / 7));
  const escalon = (12.09 - 6.96) / semanasDeSubida;

  const filas = [];
  let ruido = 0; // ruido diario del paralelo con memoria (AR(1)): evita saltos bruscos entre días
  for (let i = 0; i < dias; i++) {
    const fecha = new Date(ayer - (dias - 1 - i) * MS_DIA).toISOString().slice(0, 10);

    const oficial = i < inicioSubida ? 6.96 : Math.min(12.09, 6.96 + Math.floor((i - inicioSubida) / 7) * escalon);
    filas.push({ instrumento: 'BOB_OFICIAL', entidad: 'bcb', valor: dosDecimales(oficial), compra: dosDecimales(oficial), venta: dosDecimales(oficial), fecha, obtenidoEn: instante(fecha, 8) });

    const tendencia = 9.9 + (12.0 - 9.9) * (i / (dias - 1));
    ruido = ruido * 0.8 + (azar() - 0.5) * 0.12;
    for (const hora of HORAS_PARALELO) {
      const venta = dosDecimales(tendencia + ruido + (azar() - 0.5) * 0.04);
      const margen = 0.04 + azar() * 0.04;
      filas.push({ instrumento: 'BOB_PARALELO', entidad: 'binance', valor: venta, venta, compra: dosDecimales(venta - margen), fecha, obtenidoEn: instante(fecha, hora) });
    }
  }
  return filas;
}

module.exports = { generarSeries, aleatorio, HORAS_PARALELO };
