// El BCB no tiene API: buscamos en su portada dónde aparecen oro, UFV, inflación y dólar.
// El script NO adivina valores: imprime el texto que rodea a cada palabra clave para decidir el "ancla".
const { pedir, titulo } = require('./util');
const ANCLAS = ['Tipo de cambio oficial', 'Oro', 'UFV', 'Inflaci', 'IPC'];
(async () => {
  titulo('Portada del BCB');
  const r = await pedir('https://www.bcb.gob.bo');
  console.log('HTTP', r.status, `(${r.ms} ms)`, r.error || '');
  if (!r.ok) return;
  const texto = r.texto.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  for (const a of ANCLAS) {
    const re = new RegExp(a, 'gi');
    let m, n = 0;
    console.log(`\n--- "${a}" ---`);
    while ((m = re.exec(texto)) && n < 3) {
      console.log('…' + texto.slice(Math.max(0, m.index - 60), m.index + 160) + '…');
      n++;
    }
    if (!n) console.log('(no aparece en la portada)');
  }
})();
