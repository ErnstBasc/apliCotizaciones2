// Monedas vecinas y el euro: cuánto vale cada una en dólares y en bolivianos.
import { el, reemplazar } from '../dom.js';
import { bs, numero, multiplicadorLegible } from '../formato.js';

function celdaBob(m, tasa) {
  const unitario = m.en_bob[tasa].venta;
  const mult = multiplicadorLegible(m.en_bob.oficial.venta); // misma unidad en ambas columnas
  return el('td', { class: tasa === 'paralelo' ? 'num col-paralelo' : 'num' },
    el('span', { class: 'cifra-lista' }, bs(unitario * mult)),
    el('span', { class: 'por' }, `por ${numero(mult)} ${m.codigo}`));
}

export function pintarMonedas(contenedor, datos) {
  const filas = datos.monedas.map((m) => el('tr', {},
    el('th', { scope: 'row' }, el('div', { class: 'moneda' }, el('span', { class: 'codigo' }, m.codigo), el('span', { class: 'nombre-moneda' }, m.nombre))),
    el('td', { class: 'num' }, el('span', { class: 'cifra-lista' }, numero(m.por_usd)), el('span', { class: 'por' }, `${m.codigo} por 1 USD`)),
    celdaBob(m, 'oficial'),
    celdaBob(m, 'paralelo')));

  reemplazar(contenedor, el('div', { class: 'tabla-envoltura' },
    el('table', { class: 'tabla-monedas' },
      el('thead', {}, el('tr', {},
        el('th', { scope: 'col' }, 'Moneda'),
        el('th', { scope: 'col', class: 'num' }, 'Equivale a 1 dólar'),
        el('th', { scope: 'col', class: 'num' }, 'En bolivianos, oficial'),
        el('th', { scope: 'col', class: 'num col-paralelo' }, 'En bolivianos, paralelo'))),
      el('tbody', {}, filas))),
    el('p', { class: 'nota' }, 'Valores de venta. Las monedas de poco valor se muestran por 10, 100 o 1.000 unidades.'));
}
