// Ejecuta los 5 scripts en orden: node ejecutar_todo.js > resultados.txt
const { spawnSync } = require('child_process');
for (const f of ['01_frankfurter.js', '02_bcb.js', '03_binance.js', '04_dolarblue.js', '05_correo.js']) {
  console.log('\n\n########## ' + f + ' ##########');
  const r = spawnSync(process.execPath, [f], { cwd: __dirname, encoding: 'utf8' });
  process.stdout.write(r.stdout + (r.stderr || ''));
}
