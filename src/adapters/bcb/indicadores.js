// Adaptador de indicadores del BCB: oro, UFV e inflación. Compone los extractores (uno por archivo).
// Tolerancia a fallos parciales: si un indicador cambia de formato, los demás se guardan igual y el
// problema queda en el registro del servidor. Solo falla si NINGUNO se pudo leer.
const { crearObservacion } = require('../../contracts/observacion');
const { extraerOro } = require('./oro');
const { extraerUfv } = require('./ufv');
const { extraerInflacion } = require('./inflacion');

const INSTRUMENTOS = ['ORO', 'UFV', 'INFLACION_MENSUAL', 'INFLACION_12M'];

function crearAdaptadorBcbIndicadores({ obtenerTexto, logger = console }) {
  return {
    nombre: 'bcb',
    instrumentos: INSTRUMENTOS,
    async obtener() {
      const texto = await obtenerTexto();
      const observaciones = [];
      const intentar = (nombre, fn) => {
        try { observaciones.push(...fn()); } catch (e) { logger.error(`[bcb/${nombre}] ${e.message}`); }
      };

      intentar('oro', () => {
        const { valor, fecha } = extraerOro(texto);
        return [crearObservacion({ instrumento: 'ORO', entidad: 'bcb', valor, unidad: 'USD por onza troy', fecha })];
      });
      intentar('ufv', () => {
        const { valor, fecha } = extraerUfv(texto);
        return [crearObservacion({ instrumento: 'UFV', entidad: 'bcb', valor, unidad: 'Bs por UFV', fecha })];
      });
      intentar('inflacion', () => {
        const { mensual, doceMeses, fecha } = extraerInflacion(texto);
        return [
          crearObservacion({ instrumento: 'INFLACION_MENSUAL', entidad: 'bcb', valor: mensual, unidad: '%', fecha }),
          crearObservacion({ instrumento: 'INFLACION_12M', entidad: 'bcb', valor: doceMeses, unidad: '%', fecha }),
        ];
      });

      if (observaciones.length === 0) throw new Error('BCB: no se pudo leer ningún indicador de la portada');
      return observaciones;
    },
  };
}

module.exports = { crearAdaptadorBcbIndicadores, INSTRUMENTOS };
