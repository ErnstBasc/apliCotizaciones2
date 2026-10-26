// Bolivia está en UTC-4 todo el año (sin horario de verano). Convierte un instante a la fecha AAAA-MM-DD de Bolivia.
function fechaBolivia(instante) {
  const ms = instante instanceof Date ? instante.getTime() : Number(instante);
  return new Date(ms - 4 * 3600_000).toISOString().slice(0, 10);
}

module.exports = { fechaBolivia };
