// El tablero: el dólar oficial (un solo valor) y el paralelo (venta primero y luego compra, como en una pizarra de casa de cambio).
import { el, reemplazar } from '../dom.js';
import { bs, porcentaje } from '../formato.js';

// soloVenta: el oficial tiene un único valor, sin etiquetas de venta ni de compra
function fila(titulo, detalle, precios, indice, { soloVenta = false } = {}) {
  return el('div', { class: 'fila-tablero' },
    el('div', { class: 'fila-nombre' }, el('h3', {}, titulo), el('p', {}, detalle)),
    el('div', { class: 'celda' }, soloVenta ? null : el('span', { class: 'etiqueta' }, 'Venta'),
      el('span', { class: 'cifra cifra-venta', style: `--i:${indice * 2}` }, bs(precios.venta))),
    soloVenta ? null : el('div', { class: 'celda' }, el('span', { class: 'etiqueta' }, 'Compra'),
      el('span', { class: 'cifra cifra-compra', style: `--i:${indice * 2 + 1}` }, bs(precios.compra))));
}

export function pintarPizarra(contenedor, datos, { primeraVez }) {
  const { oficial, paralelo, brecha_porcentaje: brecha } = datos.dolar_boliviano;
  const sentido = brecha > 0 ? 'por encima del' : brecha < 0 ? 'por debajo del' : 'igual al';
  const frase = brecha === 0
    ? 'El paralelo está igual al oficial.'
    : [`El paralelo está `, el('strong', {}, porcentaje(Math.abs(brecha))), ` ${sentido} oficial.`];

  reemplazar(contenedor,
    el('div', { class: primeraVez ? 'filas anima' : 'filas' },
      fila('Oficial', 'Banco Central de Bolivia', oficial, 0, { soloVenta: true }),
      fila('Paralelo', 'Mercado P2P, Binance', paralelo, 1)),
    el('p', { class: 'brecha' }, frase),
    datos.desactualizado ? el('p', { class: 'aviso-tablero' }, 'Alguna fuente no respondió: se muestran los últimos valores guardados.') : null);
}
