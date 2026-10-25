// Utilidades compartidas por los scripts del Paso 0 (no son parte del backend final)
async function pedir(url, opciones = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), ...opciones });
    const texto = await r.text();
    return { ok: r.ok, status: r.status, ms: Date.now() - t0, texto };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, texto: '', error: e.message };
  }
}
const titulo = (t) => console.log('\n=== ' + t + ' ===');
const recorte = (s, n = 600) => (s.length > n ? s.slice(0, n) + ' …[recortado]' : s);
module.exports = { pedir, titulo, recorte };
