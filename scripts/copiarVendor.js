// Copia Chart.js desde node_modules a public/vendor/ para servirlo desde este mismo servidor (sin depender de un CDN).
// Uso: npm install && npm run vendor   (y luego se sube public/vendor/chart.umd.js a git, como cualquier otro archivo)
const fs = require('node:fs');
const path = require('node:path');

const origen = path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist');
const destinoDir = path.join(__dirname, '..', 'public', 'vendor');
const candidatos = ['chart.umd.js', 'chart.umd.min.js'];

const archivo = candidatos.find((c) => fs.existsSync(path.join(origen, c)));
if (!archivo) {
  console.error('No encuentro Chart.js en node_modules. Ejecuta primero:  npm install');
  process.exit(1);
}
fs.mkdirSync(destinoDir, { recursive: true });
fs.copyFileSync(path.join(origen, archivo), path.join(destinoDir, 'chart.umd.js'));
const kb = Math.round(fs.statSync(path.join(destinoDir, 'chart.umd.js')).size / 1024);
console.log(`Listo: public/vendor/chart.umd.js (${kb} KB, copiado de ${archivo}).`);
