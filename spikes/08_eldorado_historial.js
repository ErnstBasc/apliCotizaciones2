// Formato REAL de las rutas nuevas de dolarbluebolivia.click que encontró el spike 07:
// El Dorado, Bitget (ya resumido por ellos) y las series históricas. Solo lectura pública, sin claves.
const { pedir, titulo, recorte } = require('./util');
const BASE = 'https://api.dolarbluebolivia.click';

(async () => {
  for (const ruta of ['/v1/eldorado', '/v1/p2p/bitget', '/v1/exchanges/eldorado', '/v1/official-unificado', '/v1/chart/oficial', '/v1/chart/6m']) {
    titulo('GET ' + ruta);
    const r = await pedir(BASE + ruta);
    console.log('HTTP', r.status, `(${r.ms} ms)`, r.error || '', '| tamaño', r.texto.length, 'caracteres');
    try {
      const j = JSON.parse(r.texto);
      const clave = Object.keys(j);
      console.log('Claves de primer nivel:', clave.join(', '));
      for (const k of clave) if (Array.isArray(j[k])) console.log(`"${k}" es una lista de ${j[k].length}; primer elemento:`, JSON.stringify(j[k][0]), '| último:', JSON.stringify(j[k].at(-1)));
    } catch { /* no era JSON */ }
    console.log(recorte(r.texto, 700));
  }
})();
