// Dónde conviene comprar y dónde vender dólares.
import { el, reemplazar } from '../dom.js';
import { bs, porcentaje } from '../formato.js';

const TIPOS = { referencia: 'Oficial', exchange: 'P2P', billetera: 'Billetera', banco: 'Banco' };
const VISIBLES = 5;

function item(lugar, esMejor) {
  const referencia = lugar.tipo === 'referencia';
  const dif = referencia ? 'Precio de referencia' : porcentaje(lugar.diferencia_vs_oficial_pct ?? 0, true) + ' sobre el oficial';
  return el('li', { class: esMejor ? 'lugar mejor' : referencia ? 'lugar referencia' : 'lugar' },
    el('div', { class: 'lugar-info' },
      el('span', { class: 'lugar-nombre' }, referencia ? 'Dólar oficial (BCB)' : lugar.nombre),
      referencia ? null : el('span', { class: 'tipo' }, TIPOS[lugar.tipo] ?? lugar.tipo),
      esMejor ? el('span', { class: 'sello' }, 'Mejor precio') : null),
    el('div', { class: 'lugar-precio' },
      el('span', { class: 'cifra-lista' }, bs(lugar.precio)),
      el('span', { class: 'dif' }, dif)));
}

function columna(titulo, ayuda, lista, mejor) {
  const items = lista.map((l) => item(l, mejor && mejor.entidad === l.entidad));
  const ol = el('ol', { class: 'lista-lugares' }, items.slice(0, VISIBLES));
  const resto = items.slice(VISIBLES);
  const extras = resto.length
    ? el('div', {},
      el('ol', { class: 'lista-lugares', hidden: true, id: `mas-${titulo.length}` }, resto),
      el('button', {
        type: 'button', class: 'boton boton-texto', 'aria-expanded': 'false',
        onclick: (e) => {
          const lista2 = e.currentTarget.previousElementSibling;
          const abierto = lista2.hidden;
          lista2.hidden = !abierto;
          e.currentTarget.setAttribute('aria-expanded', String(abierto));
          e.currentTarget.textContent = abierto ? 'Ver menos' : `Ver los ${resto.length} restantes`;
        },
      }, `Ver los ${resto.length} restantes`))
    : null;
  return el('div', { class: 'columna' }, el('h3', {}, titulo), el('p', { class: 'ayuda-columna' }, ayuda), ol, extras);
}

export function pintarComparacion(contenedor, datos) {
  const notas = [];
  if (datos.excluidas_por_desactualizadas > 0) {
    const n = datos.excluidas_por_desactualizadas;
    notas.push(`${n} ${n === 1 ? 'precio desactualizado no se incluye' : 'precios desactualizados no se incluyen'}.`);
  }
  if (datos.fuentes_con_error.length) notas.push(`No se pudo consultar: ${datos.fuentes_con_error.join(', ')}.`);

  reemplazar(contenedor,
    el('div', { class: 'rejilla-comparacion' },
      columna('Si quieres comprar dólares', 'Conviene la venta más baja.', datos.comprar_dolares, datos.mejor_para_comprar),
      columna('Si quieres vender dólares', 'Conviene la compra más alta.', datos.vender_dolares, datos.mejor_para_vender)),
    el('p', { class: 'nota' }, 'Precios de pizarra de cada entidad. ', notas.join(' ')));
}
