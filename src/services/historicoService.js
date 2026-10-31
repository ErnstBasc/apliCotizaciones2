// Servicio del histórico: arma la serie diaria del dólar oficial y/o paralelo para un rango de días.
// No sabe de HTTP ni de SQL: pide al repositorio el último valor de cada día y lo ordena para el gráfico.
// Los días sin datos simplemente no aparecen (el gráfico los salta; no se inventa ningún valor).
const { SERIES } = require('../dominio/historico');
const { fechaBolivia } = require('../utilidades/fechas');

const MS_DIA = 86_400_000;
const sumarDias = (fecha, dias) => new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * MS_DIA).toISOString().slice(0, 10);

function crearServicioHistorico({ repositorio, reloj = () => Date.now() }) {
  return {
    // serie: 'oficial' | 'paralelo' | 'ambos' · dias: cuántos días hacia atrás, contando hoy (ya validados)
    async consultar({ serie, dias }) {
      const hasta = fechaBolivia(reloj());
      const desde = sumarDias(hasta, -(dias - 1));
      const nombres = serie === 'ambos' ? ['oficial', 'paralelo'] : [serie];
      const resultados = await Promise.all(nombres.map((n) => repositorio.ultimoPorDia({ ...SERIES[n], desde })));
      return { dias, desde, hasta, series: Object.fromEntries(nombres.map((n, i) => [n, resultados[i]])) };
    },
  };
}

module.exports = { crearServicioHistorico, sumarDias };
