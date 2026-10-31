// Tabla de precios en bolivianos por dólar: nombre, venta (con énfasis) y compra.
// La usan las tarjetas de bancos y de billeteras y sitios. Los destacados ("Mejor") solo se marcan si se pide.
import { el } from '../dom.js';
import { bs } from '../formato.js';

const noDisponible = (texto = 'No disponible') => el('span', { class: 'no-disponible' }, texto);

function celdaPrecio(valor, { grande, mejor, etiquetaMejor, apagada }) {
  if (valor === null || valor === undefined) return el('td', { class: 'num' }, noDisponible('—'));
  return el('td', { class: mejor ? 'num mejor-celda' : 'num' },
    el('span', { class: grande ? 'cifra-lista' : 'cifra-lista cifra-menor' }, bs(valor)),
    mejor ? el('span', { class: 'sello' }, etiquetaMejor) : null,
    apagada ? el('span', { class: 'por' }, 'Desactualizado') : null);
}

// filas: [{ nombre, detalle?: nodos, venta, compra, mejorVenta?, mejorCompra?, apagada? }]
export function tablaPrecios(titulo, filas) {
  return el('div', { class: 'tabla-envoltura' },
    el('table', { class: 'tabla-precios' },
      el('thead', {}, el('tr', {},
        el('th', { scope: 'col' }, titulo),
        el('th', { scope: 'col', class: 'num' }, 'Venta'),
        el('th', { scope: 'col', class: 'num' }, 'Compra'))),
      el('tbody', {}, filas.map((f) => el('tr', { class: f.apagada ? 'apagada' : null },
        el('th', { scope: 'row' }, el('span', { class: 'nombre-entidad' }, f.nombre), f.detalle ?? null),
        celdaPrecio(f.venta, { grande: true, mejor: f.mejorVenta, etiquetaMejor: 'Mejor', apagada: f.apagada }),
        celdaPrecio(f.compra, { grande: false, mejor: f.mejorCompra, etiquetaMejor: 'Mejor', apagada: false }))))));
}
