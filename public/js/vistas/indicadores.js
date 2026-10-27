// Oro, UFV e inflación del BCB. Un indicador ausente se muestra como "No disponible" sin romper los demás.
import { el, reemplazar } from '../dom.js';
import { bs, numero, porcentaje, mesDe, fechaCorta } from '../formato.js';

function dato(titulo, valor, detalle) {
  return el('div', { class: 'dato' },
    el('dt', {}, titulo),
    el('dd', {},
      valor ? el('span', { class: 'cifra-lista' }, valor) : el('span', { class: 'no-disponible' }, 'No disponible'),
      detalle ? el('span', { class: 'por' }, detalle) : null));
}

export function pintarIndicadores(contenedor, datos) {
  const { oro, ufv, inflacion } = datos;
  const mes = mesDe(inflacion.mensual?.fecha_fuente);
  reemplazar(contenedor, el('dl', { class: 'datos' },
    dato('Oro', oro && bs(oro.valor), oro && `dólares por onza troy${oro.fecha_fuente ? `, al ${fechaCorta(oro.fecha_fuente)}` : ''}`),
    dato('UFV', ufv && numero(ufv.valor), ufv && 'bolivianos por UFV'),
    dato('Inflación del mes', inflacion.mensual && porcentaje(inflacion.mensual.valor), mes),
    dato('Inflación en 12 meses', inflacion.doce_meses && porcentaje(inflacion.doce_meses.valor), mes)));
}
