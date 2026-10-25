// ¿Frankfurter v2 trae PYG (guaraní) y las demás monedas? ¿De qué fecha?
const { pedir, titulo } = require('./util');
(async () => {
  titulo('Frankfurter v2: EUR, CLP, ARS, PEN, BRL, PYG, BOB contra USD');
  const r = await pedir('https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,CLP,ARS,PEN,BRL,PYG,BOB');
  console.log('HTTP', r.status, `(${r.ms} ms)`, r.error || '');
  if (!r.ok) return console.log(r.texto.slice(0, 300));
  const datos = JSON.parse(r.texto);
  const lista = Array.isArray(datos) ? datos : datos.rates || datos;
  console.log(Array.isArray(lista) ? lista : JSON.stringify(lista, null, 2));
  const codigos = Array.isArray(lista) ? lista.map((x) => x.quote) : Object.keys(lista);
  for (const c of ['EUR', 'CLP', 'ARS', 'PEN', 'BRL', 'PYG', 'BOB'])
    console.log(c.padEnd(4), codigos.includes(c) ? 'SÍ viene' : 'NO viene');
})();
