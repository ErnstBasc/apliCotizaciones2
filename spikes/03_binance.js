// Precio P2P USDT/BOB en Binance.
// OJO: es un endpoint NO documentado (el que usa la propia web de Binance). Puede cambiar o bloquearse.
const { pedir, titulo } = require('./util');
async function anuncios(tradeType) {
  const r = await pedir('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fiat: 'BOB', asset: 'USDT', tradeType, page: 1, rows: 10, payTypes: [], publisherType: null }),
  });
  console.log(tradeType, '→ HTTP', r.status, `(${r.ms} ms)`, r.error || '');
  if (!r.ok) return console.log(r.texto.slice(0, 300)), [];
  const j = JSON.parse(r.texto);
  return (j.data || []).map((x) => ({ precio: Number(x.adv.price), min: x.adv.minSingleTransAmount, max: x.adv.dynamicMaxSingleTransAmount, vendedor: x.advertiser.nickName }));
}
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
(async () => {
  titulo('Binance P2P USDT/BOB');
  for (const lado of ['BUY', 'SELL']) {
    const l = await anuncios(lado);
    console.table(l);
    if (l.length) console.log(`${lado}: mejor ${l[0].precio} · mediana de ${l.length} anuncios = ${mediana(l.map((x) => x.precio))}`);
  }
  console.log('\nBUY = tú compras USDT (el anunciante vende); SELL = tú vendes USDT.');
})();
