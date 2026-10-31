// Repositorio de usuarios EN MEMORIA con el mismo contrato que el real, para probar el servicio sin base de datos.
function crearRepositorioFalso() {
  const usuarios = new Map(); const tokens = []; let sig = 1;
  const repo = {
    usuarios, tokens,
    async crear({ correo, claveHash }) {
      if ([...usuarios.values()].some((u) => u.correo === correo)) return null;
      const u = { id: sig++, correo, claveHash, rol: 'registrado', verificadoEn: null, intentosFallidos: 0, bloqueadoHasta: null, versionSesion: 0, creadoEn: new Date('2026-10-31T12:00:00Z') };
      usuarios.set(u.id, u); return { ...u };
    },
    async buscarPorCorreo(c) { const u = [...usuarios.values()].find((x) => x.correo === c); return u ? { ...u } : null; },
    async buscarPorId(id) { const u = usuarios.get(id); return u ? { ...u } : null; },
    async marcarVerificado(id, ahora) { const u = usuarios.get(id); if (u && !u.verificadoEn) u.verificadoEn = ahora; },
    async registrarFallo(id, { maximo, bloqueadoHasta }) {
      const u = usuarios.get(id);
      if (u.intentosFallidos + 1 >= maximo) { u.intentosFallidos = 0; u.bloqueadoHasta = bloqueadoHasta; } else u.intentosFallidos += 1;
    },
    async reiniciarIntentos(id) { const u = usuarios.get(id); u.intentosFallidos = 0; u.bloqueadoHasta = null; },
    async actualizarClave(id, claveHash) { const u = usuarios.get(id); Object.assign(u, { claveHash, versionSesion: u.versionSesion + 1, intentosFallidos: 0, bloqueadoHasta: null }); return { ...u }; },
    async eliminar(id) { usuarios.delete(id); for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i].usuarioId === id) tokens.splice(i, 1); },
    async guardarToken({ usuarioId, tipo, tokenHash, expiraEn }) {
      for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i].usuarioId === usuarioId && tokens[i].tipo === tipo && !tokens[i].usadoEn) tokens.splice(i, 1);
      tokens.push({ usuarioId, tipo, tokenHash, expiraEn, usadoEn: null });
    },
    async consumirToken({ tokenHash, tipo, ahora }) {
      const t = tokens.find((x) => x.tokenHash === tokenHash && x.tipo === tipo && !x.usadoEn && x.expiraEn > ahora);
      if (!t) return null; t.usadoEn = ahora; return t.usuarioId;
    },
  };
  return repo;
}

// Claves "baratas" para que los tests sean rápidos y deterministas (la lógica real de scrypt se prueba aparte)
const clavesFalsas = {
  async hashear(c) { return `hash:${c}`; },
  async verificar(c, h) { return h === `hash:${c}`; },
};

module.exports = { crearRepositorioFalso, clavesFalsas };
