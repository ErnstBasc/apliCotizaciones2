// Validación de parámetros de entrada por LISTA BLANCA: solo se acepta lo que se espera, nada más.
const { ErrorValidacion } = require('../errores');
const { MONEDAS_SOPORTADAS, TASAS_BOB, LADOS } = require('../dominio/monedas');
const { SERIES_ALERTA, LADOS: LADOS_ALERTA, TIPOS: TIPOS_ALERTA, LIMITES_UMBRAL } = require('../dominio/alertas');
const { SELECCIONES, DIAS_PERMITIDOS, FORMATOS_CSV } = require('../dominio/historico');

// Un parámetro repetido (?monto=1&monto=2) llega como arreglo: se rechaza.
function texto(query, nombre, porDefecto) {
  const v = query[nombre];
  if (v === undefined) return porDefecto;
  if (typeof v !== 'string') throw new ErrorValidacion(`El parámetro "${nombre}" debe indicarse una sola vez`);
  return v;
}

function validarConversion(query) {
  const monto = texto(query, 'monto');
  if (monto === undefined || !/^\d{1,12}(\.\d{1,6})?$/.test(monto)) {
    throw new ErrorValidacion('El parámetro "monto" debe ser un número mayor o igual a 0, con punto decimal (ejemplo: 100 o 25.5)');
  }
  const de = (texto(query, 'de') ?? '').toUpperCase();
  const a = (texto(query, 'a') ?? '').toUpperCase();
  for (const [nombre, codigo] of [['de', de], ['a', a]]) {
    if (!MONEDAS_SOPORTADAS.includes(codigo)) {
      throw new ErrorValidacion(`Moneda no soportada en "${nombre}". Soportadas: ${MONEDAS_SOPORTADAS.join(', ')}`);
    }
  }
  const tasa = texto(query, 'tasa', 'oficial');
  if (!TASAS_BOB.includes(tasa)) throw new ErrorValidacion(`El parámetro "tasa" debe ser: ${TASAS_BOB.join(' o ')}`);
  const lado = texto(query, 'lado', 'venta');
  if (!LADOS.includes(lado)) throw new ErrorValidacion(`El parámetro "lado" debe ser: ${LADOS.join(' o ')}`);
  return { monto: Number(monto), de, a, tasa, lado };
}

function validarHistorico(query) {
  const serie = texto(query, 'serie', 'ambos');
  if (!SELECCIONES.includes(serie)) throw new ErrorValidacion(`El parámetro "serie" debe ser: ${SELECCIONES.join(', ')}`);
  const bruto = texto(query, 'dias', '30');
  const dias = /^\d{1,3}$/.test(bruto) ? Number(bruto) : NaN; // solo dígitos: nada de "30abc", "1e2" ni "-7"
  if (!DIAS_PERMITIDOS.includes(dias)) throw new ErrorValidacion(`El parámetro "dias" debe ser: ${DIAS_PERMITIDOS.join(', ')}`);
  return { serie, dias };
}

function validarExportacion(query) {
  const formato = texto(query, 'formato', 'excel');
  if (!FORMATOS_CSV.includes(formato)) throw new ErrorValidacion(`El parámetro "formato" debe ser: ${FORMATOS_CSV.join(' o ')}`);
  return { ...validarHistorico(query), formato };
}

// ---- Cuentas de usuario (cuerpo JSON) ----
const CLAVE_MIN = 10;
const CLAVE_MAX = 128;

function cuerpoObjeto(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw new ErrorValidacion('El cuerpo de la petición debe ser un objeto JSON');
  return cuerpo;
}
function campoTexto(cuerpo, nombre) {
  const v = cuerpoObjeto(cuerpo)[nombre];
  if (typeof v !== 'string' || v === '') throw new ErrorValidacion(`Falta el campo "${nombre}"`);
  return v;
}
// Correo: solo caracteres comunes (letras, números y . _ % + - en la parte local; letras, números y guiones en el dominio).
// Estricto A PROPÓSITO: símbolos como ; < > ( ) " , confunden a los analizadores de direcciones y permiten colar destinatarios extra.
// Consecuencia: no se aceptan correos con letras fuera del alfabeto básico (ñ, acentos, dominios en ñandú.bo…).
const LOCAL_CORREO = /^[a-z0-9_%+-]+(\.[a-z0-9_%+-]+)*$/;
const DOMINIO_CORREO = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
function correo(cuerpo) {
  const v = campoTexto(cuerpo, 'correo').trim().toLowerCase();
  const partes = v.split('@');
  const valido = v.length <= 254 && partes.length === 2 && partes[0].length <= 64 && LOCAL_CORREO.test(partes[0]) && DOMINIO_CORREO.test(partes[1]);
  if (!valido) throw new ErrorValidacion('Escribe un correo válido');
  return v;
}
function claveNueva(cuerpo, nombre = 'clave') {
  const v = campoTexto(cuerpo, nombre);
  if (v.length < CLAVE_MIN || v.length > CLAVE_MAX) throw new ErrorValidacion(`La contraseña debe tener entre ${CLAVE_MIN} y ${CLAVE_MAX} caracteres`);
  return v;
}
function claveExistente(cuerpo, nombre = 'clave') { // al ingresar no se exige el largo mínimo, solo un tope para no procesar textos enormes
  const v = campoTexto(cuerpo, nombre);
  if (v.length > CLAVE_MAX) throw new ErrorValidacion('Contraseña demasiado larga');
  return v;
}
function token(cuerpo) {
  const v = campoTexto(cuerpo, 'token');
  if (!/^[A-Za-z0-9_-]{43}$/.test(v)) throw new ErrorValidacion('El enlace no es válido o ya venció');
  return v;
}

const validarRegistro = (b) => ({ correo: correo(b), clave: claveNueva(b) });
const validarIngreso = (b) => ({ correo: correo(b), clave: claveExistente(b) });
const validarCorreo = (b) => ({ correo: correo(b) });
const validarToken = (b) => ({ token: token(b) });
const validarRestablecer = (b) => ({ token: token(b), clave: claveNueva(b) });
const validarCambioClave = (b) => ({ claveActual: claveExistente(b, 'claveActual'), claveNueva: claveNueva(b, 'claveNueva') });
const validarEliminacion = (b) => ({ clave: claveExistente(b) });

// ---- Alertas ----
function validarAlerta(cuerpo) {
  cuerpoObjeto(cuerpo);
  const elegir = (nombre, permitidos, porDefecto) => {
    const v = cuerpo[nombre] === undefined ? porDefecto : cuerpo[nombre];
    if (!permitidos.includes(v)) throw new ErrorValidacion(`El campo "${nombre}" debe ser: ${permitidos.join(', ')}`);
    return v;
  };
  const serie = elegir('serie', SERIES_ALERTA);
  const tipo = elegir('tipo', TIPOS_ALERTA);
  const lado = serie === 'oficial' ? 'venta' : elegir('lado', LADOS_ALERTA, 'venta'); // el oficial tiene un solo valor
  const u = cuerpo.umbral;
  if (typeof u !== 'number' || !Number.isFinite(u)) throw new ErrorValidacion('El campo "umbral" debe ser un número');
  const { min, max } = tipo === 'cambio_pct' ? LIMITES_UMBRAL.porcentaje : LIMITES_UMBRAL.precio;
  const umbral = Math.round(u * 100) / 100;
  if (umbral < min || umbral > max) throw new ErrorValidacion(`El umbral debe estar entre ${min} y ${max}${tipo === 'cambio_pct' ? ' (%)' : ' (Bs)'}`);
  return { serie, lado, tipo, umbral };
}
function validarActiva(cuerpo) {
  if (typeof cuerpoObjeto(cuerpo).activa !== 'boolean') throw new ErrorValidacion('El campo "activa" debe ser true o false');
  return { activa: cuerpo.activa };
}
function validarIdAlerta(params) {
  const id = params && params.id;
  if (typeof id !== 'string' || !/^\d{1,15}$/.test(id)) throw new ErrorValidacion('Identificador de alerta inválido');
  return Number(id);
}

module.exports = {
  validarAlerta, validarActiva, validarIdAlerta,
  validarConversion, validarHistorico, validarExportacion, validarRegistro, validarIngreso, validarCorreo, validarToken,
  validarRestablecer, validarCambioClave, validarEliminacion, CLAVE_MIN, CLAVE_MAX,
};
