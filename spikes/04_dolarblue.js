// Mira el formato REAL de cada endpoint de dolarbluebolivia.click (billeteras y bancos).
// Imprime el JSON crudo para que decidamos cómo mapearlo.
const { pedir, titulo, recorte } = require('./util');
const BASE = 'https://api.dolarbluebolivia.click';
const RUTAS = ['/v1/officialRate', '/v1/wallbit', '/v1/banks', '/v1/bancos', '/v1/binance'];
(async () => {
  for (const ruta of RUTAS) {
    titulo(BASE + ruta);
    const r = await pedir(BASE + ruta);
    console.log('HTTP', r.status, `(${r.ms} ms)`, r.error || '');
    console.log(recorte(r.texto, 1500));
  }
  console.log('\nNota: /v1/banks, /v1/bancos y /v1/binance son suposiciones; un 404 es información útil.');
})();
