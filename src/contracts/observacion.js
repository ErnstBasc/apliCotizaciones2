// Contrato común: TODA fuente (BCB, Frankfurter, Binance, Wallbit, bancos…) entrega Observaciones con
// esta misma forma. El resto del sistema (repositorio, caché, cálculos, rutas) solo conoce este contrato
// y nunca el formato propio de cada fuente. Es la base del principio de Inversión de Dependencias (D).
//
// { instrumento, entidad, valor, compra, venta, unidad, fecha, estado }
//   instrumento: código del instrumento ('EUR', 'BOB_BANCO', 'ORO'…)
//   entidad:     quién cotiza ('fie', 'wallbit', 'binance'…) o null si no aplica
//   valor:       valor de referencia (en tipos de cambio: la venta)
//   compra/venta: lo que recibes al vender / lo que pagas al comprar 1 USD (o null)
//   unidad:      'por USD', 'USD/onza troy', 'Bs/UFV', '%'…
//   fecha:       'AAAA-MM-DD' que declara la fuente (o null)
//   estado:      'vigente' | 'desactualizado'

const ESTADOS = ['vigente', 'desactualizado'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esNumero = (x) => typeof x === 'number' && Number.isFinite(x);
const numeroONull = (x) => (x === undefined || x === null ? null : x);

// Construye una Observacion validada; lanza Error si algo no cuadra (así un dato roto no llega a la base).
function crearObservacion(datos) {
  const o = {
    instrumento: datos.instrumento,
    entidad: datos.entidad ?? null,
    valor: numeroONull(datos.valor),
    compra: numeroONull(datos.compra),
    venta: numeroONull(datos.venta),
    unidad: datos.unidad ?? null,
    fecha: datos.fecha ?? null,
    estado: datos.estado ?? 'vigente',
  };

  if (typeof o.instrumento !== 'string' || o.instrumento.trim() === '') {
    throw new Error('Observacion: falta el instrumento');
  }
  for (const campo of ['valor', 'compra', 'venta']) {
    if (o[campo] !== null && !esNumero(o[campo])) {
      throw new Error(`Observacion ${o.instrumento}: "${campo}" no es un número válido`);
    }
  }
  if (o.valor === null && o.compra === null && o.venta === null) {
    throw new Error(`Observacion ${o.instrumento}: no trae ningún valor`);
  }
  if (o.fecha !== null && !FECHA.test(o.fecha)) {
    throw new Error(`Observacion ${o.instrumento}: la fecha debe ser AAAA-MM-DD`);
  }
  if (!ESTADOS.includes(o.estado)) {
    throw new Error(`Observacion ${o.instrumento}: estado inválido "${o.estado}"`);
  }
  return Object.freeze(o);
}

module.exports = { crearObservacion, ESTADOS };
