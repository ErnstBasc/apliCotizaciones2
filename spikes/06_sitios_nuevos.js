// Paso 0 de la iteración 2: ¿Bitget, Takenos y Airtm ofrecen datos del dólar en Bolivia que podamos leer sin cuenta?
// IMPORTANTE: las rutas de Bitget y de dolarbluebolivia son SUPOSICIONES; un 404 o un rechazo también es información útil.
// No usa claves ni datos personales. Solo lee información pública.
const { pedir, titulo, recorte } = require('./util');

(async () => {
  // 1) ¿dolarbluebolivia.click (que ya usamos) publica más fuentes?
  const BASE = 'https://api.dolarbluebolivia.click';
  for (const ruta of ['/', '/docs', '/v1', '/v1/bitget', '/v1/airtm', '/v1/takenos', '/v1/exchanges', '/v1/p2p', '/v1/rates']) {
    titulo('dolarblue GET ' + ruta);
    const r = await pedir(BASE + ruta);
    console.log('HTTP', r.status, `(${r.ms} ms)`, r.error || '');
    console.log(recorte(r.texto, 500));
  }

  // 2) Bitget P2P: anuncios de USDT contra BOB (ruta y cuerpo supuestos)
  titulo('Bitget P2P: anuncios USDT/BOB (lado 1 = comprar, lado 2 = vender; supuesto)');
  for (const side of [1, 2]) {
    const r = await pedir('https://www.bitget.com/v1/p2p/pub/adv/queryAdvList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ side, pageNo: 1, pageSize: 10, coinCode: 'USDT', fiatCode: 'BOB', languageType: 6 }),
    });
    console.log('side', side, '-> HTTP', r.status, `(${r.ms} ms)`, r.error || '');
    console.log(recorte(r.texto, 900));
  }

  // 3) Takenos y Airtm: ¿sus páginas públicas mencionan el tipo de cambio a bolivianos?
  for (const [nombre, url] of [['Takenos', 'https://takenos.com'], ['Airtm', 'https://www.airtm.com']]) {
    titulo(`${nombre} (página pública): ${url}`);
    const r = await pedir(url);
    console.log('HTTP', r.status, `(${r.ms} ms)`, r.error || '');
    const hallazgos = (r.texto.match(/.{0,60}(BOB|Bolivia|boliviano).{0,60}/gi) || []).slice(0, 5);
    console.log(hallazgos.length ? hallazgos.join('\n---\n') : 'Sin menciones a Bolivia/BOB en el HTML inicial.');
  }

  console.log('\nSiguiente paso: pega este resultado completo y revisamos qué se puede leer de forma estable.');
})();
