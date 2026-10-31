// Detalle de lo que encontró el spike 06: (1) qué endpoints y qué límites tiene dolarbluebolivia.click,
// (2) qué campos trae Bitget P2P (precio, mínimo y máximo de cada anuncio). No usa claves ni datos personales.
const { pedir, titulo, recorte } = require('./util');
const BASE = 'https://api.dolarbluebolivia.click';

(async () => {
  titulo('dolarblue: /openapi.json (lista de rutas, seguridad y descripción)');
  const r = await pedir(BASE + '/openapi.json');
  console.log('HTTP', r.status, `(${r.ms} ms)`, r.error || '');
  try {
    const o = JSON.parse(r.texto);
    console.log('Descripción:', recorte(o.info?.description || '(sin descripción)', 1500));
    console.log('Seguridad:', JSON.stringify(o.components?.securitySchemes || 'ninguna'));
    for (const [ruta, metodos] of Object.entries(o.paths || {}))
      console.log(Object.keys(metodos).join(',').toUpperCase().padEnd(6), ruta, '-', metodos[Object.keys(metodos)[0]].summary || '');
  } catch { console.log(recorte(r.texto, 800)); }

  titulo('dolarblue: cabeceras de /v1/airtm (límites de uso)');
  try {
    const h = await fetch(BASE + '/v1/airtm', { signal: AbortSignal.timeout(15000) });
    for (const [k, v] of h.headers) if (/rate|limit|key|retry|cache|age/i.test(k)) console.log(k + ':', v);
    console.log('HTTP', h.status);
  } catch (e) { console.log('error', e.message); }

  for (const side of [1, 2]) {
    titulo(`Bitget P2P side ${side}: primeros 5 anuncios (solo campos de precio y límites)`);
    const b = await pedir('https://www.bitget.com/v1/p2p/pub/adv/queryAdvList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ side, pageNo: 1, pageSize: 10, coinCode: 'USDT', fiatCode: 'BOB', languageType: 6 }),
    });
    console.log('HTTP', b.status, `(${b.ms} ms)`, b.error || '');
    try {
      const lista = JSON.parse(b.texto).data.dataList;
      console.log('Anuncios recibidos:', lista.length, '| campos de precio/límite en el primero:');
      const campos = Object.keys(lista[0]).filter((k) => /price|min|max|adType|amount|side/i.test(k));
      for (const a of lista.slice(0, 5)) console.log(JSON.stringify(Object.fromEntries(campos.map((k) => [k, a[k]]))));
    } catch (e) { console.log('No pude leer la estructura:', e.message, recorte(b.texto, 400)); }
  }
})();
