// Tarjeta de bancos: precios de pizarra, ordenados por venta. Se destaca la mejor opción para comprar y para vender.
import { el, reemplazar } from '../dom.js';
import { tablaPrecios } from './precios.js';

export function pintarBancos(contenedor, datos) {
  const mejorVenta = datos.resumen?.mejor_para_comprar?.entidad;
  const mejorCompra = datos.resumen?.mejor_para_vender?.entidad;
  const filas = datos.bancos.map((b) => {
    const vigente = (b.estado ?? 'vigente') === 'vigente';
    return {
      nombre: b.entidad_nombre ?? b.entidad,
      venta: vigente ? b.venta ?? null : null,
      compra: vigente ? b.compra ?? null : null,
      mejorVenta: vigente && b.entidad === mejorVenta,
      mejorCompra: vigente && b.entidad === mejorCompra,
      apagada: !vigente,
      detalle: vigente ? null : el('span', { class: 'por' }, b.estado === 'no_leido' ? 'No se pudo leer su pizarra' : 'Dato desactualizado'),
    };
  });
  reemplazar(contenedor,
    el('div', { class: 'panel panel-tabla' }, tablaPrecios('Banco', filas)),
    el('p', { class: 'nota' }, datos.aviso ?? 'Precios de pizarra publicados por cada banco.'));
}
