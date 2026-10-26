// Presentadores: convierten una observación interna en el JSON público (claves en español).
// En dólar/boliviano se muestra primero la venta y luego la compra, como es costumbre en Bolivia.
function presentarCotizacion(o) {
  const salida = { codigo: o.instrumento, nombre: o.nombre };
  if (o.entidad) salida.entidad = o.entidad;
  if (o.entidadNombre) salida.entidad_nombre = o.entidadNombre;
  if (o.venta !== null) salida.venta = o.venta;
  if (o.compra !== null) salida.compra = o.compra;
  if (o.valor !== null) salida.valor = o.valor;
  salida.unidad = o.unidad;
  salida.fecha_fuente = o.fecha;
  salida.obtenido_en = o.obtenidoEn;
  if (o.estado !== 'vigente') salida.estado = o.estado;
  return salida;
}

module.exports = { presentarCotizacion };
