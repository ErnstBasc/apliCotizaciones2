// Tarjeta de billeteras digitales y sitios de intercambio (Wallbit, Airtm, Takenos, Binance, Bitget, El Dorado…).
// Sin destacados: son referencias de mercado, no se recomienda una sobre otra.
import { el, reemplazar } from '../dom.js';
import { hora } from '../formato.js';
import { tablaPrecios } from './precios.js';

// Para sumar otro sitio de intercambio solo hace falta agregarlo aquí; lo que no esté en la lista se muestra como "Billetera".
const MERCADOS_P2P = new Set(['binance', 'bitget', 'eldorado']);
const tipoDe = (entidad) => (MERCADOS_P2P.has(entidad) ? 'P2P' : 'Billetera');

const detalle = (tipo, obtenidoEn, vigente) => {
  const fecha = obtenidoEn ? new Date(obtenidoEn) : null;
  return el('span', { class: 'detalle-entidad' },
    el('span', { class: 'tipo' }, tipo),
    vigente && fecha && !Number.isNaN(fecha.getTime()) ? el('span', { class: 'por' }, `Dato de las ${hora(fecha)}`) : null,
    vigente ? null : el('span', { class: 'por' }, 'Sin dato reciente'));
};

function filaDe(o) {
  const vigente = (o.estado ?? 'vigente') === 'vigente';
  return {
    nombre: o.entidad_nombre ?? o.nombre,
    venta: vigente ? o.venta ?? null : null,
    compra: vigente ? o.compra ?? null : null,
    apagada: !vigente,
    detalle: detalle(tipoDe(o.entidad), o.obtenido_en, vigente),
  };
}

// datos: { paralelo: respuesta de /paralelo o null, billeteras: respuesta de /billeteras o null }
export function pintarSitios(contenedor, datos) {
  const observaciones = [];
  if (datos.paralelo) observaciones.push(datos.paralelo.paralelo);
  observaciones.push(...(datos.billeteras?.billeteras ?? []));
  // Primero los que tienen dato, y entre ellos de menor a mayor venta; los demás al final
  const filas = observaciones.map(filaDe).sort((a, b) => (a.apagada - b.apagada) || ((a.venta ?? Infinity) - (b.venta ?? Infinity)));

  const fallan = [!datos.paralelo && 'Binance P2P', !datos.billeteras && 'billeteras y plataformas'].filter(Boolean);
  const desactualizado = datos.paralelo?.desactualizado || datos.billeteras?.desactualizado;

  reemplazar(contenedor,
    el('div', { class: 'panel panel-tabla' }, tablaPrecios('Billetera o sitio', filas)),
    el('p', { class: 'nota' }, 'Plataformas digitales y mercados P2P, ordenados por venta; ninguno se destaca. ',
      fallan.length ? `No se pudo consultar: ${fallan.join(', ')}. ` : null,
      desactualizado ? 'Alguna fuente no respondió: se muestran los últimos valores guardados.' : null));
}
