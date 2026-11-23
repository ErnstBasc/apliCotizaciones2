// El tablero: tres tarjetas. Paralelo (venta destacada y compra al lado), oficial (un solo valor) y la brecha entre ambos.
import { el, reemplazar } from '../dom.js';
import { bs, porcentaje } from '../formato.js';

// soloVenta: el oficial tiene un único valor, sin etiquetas de venta ni de compra
function tarjeta(titulo, detalle, precios, indice, { soloVenta = false, principal = false } = {}) {
  return el('div', { class: principal ? 'fila-tablero tarjeta-principal' : 'fila-tablero' },
    el('div', { class: 'fila-nombre' }, el('h3', {}, titulo), el('p', {}, detalle)),
    el('div', { class: 'cifras-tarjeta' },
      el('div', { class: 'celda' }, el('span', { class: 'etiqueta' }, soloVenta ? 'Compra y venta' : 'Venta'),
        el('span', { class: 'cifra cifra-venta', style: { '--i': indice * 2 } }, bs(precios.venta))),
      soloVenta ? null : el('div', { class: 'celda' }, el('span', { class: 'etiqueta' }, 'Compra'),
        el('span', { class: 'cifra cifra-compra', style: { '--i': indice * 2 + 1 } }, bs(precios.compra)))));
}

export function pintarPizarra(contenedor, datos, { primeraVez }) {
  const { oficial, paralelo, brecha_porcentaje: brecha } = datos.dolar_boliviano;
  const sentido = brecha > 0 ? 'por encima del oficial' : brecha < 0 ? 'por debajo del oficial' : 'igual al oficial';

  reemplazar(contenedor,
    el('div', { class: primeraVez ? 'filas anima' : 'filas' },
      tarjeta('Paralelo', 'Mercado P2P, Binance', paralelo, 0, { principal: true }),
      tarjeta('Oficial', 'Banco Central de Bolivia', oficial, 1, { soloVenta: true }),
      el('div', { class: 'fila-tablero' },
        el('div', { class: 'fila-nombre' }, el('h3', {}, 'Brecha'), el('p', {}, 'Venta paralelo frente al oficial')),
        el('div', { class: 'cifras-tarjeta' },
          el('div', { class: 'celda' },
            el('span', { class: 'cifra cifra-venta', style: { '--i': 4 } }, porcentaje(Math.abs(brecha))),
            el('span', { class: 'brecha' }, brecha === 0 ? 'El paralelo está igual al oficial' : `El paralelo está ${sentido}`))))),
    datos.desactualizado ? el('p', { class: 'aviso-tablero' }, 'Alguna fuente no respondió: se muestran los últimos valores guardados.') : null);
}
