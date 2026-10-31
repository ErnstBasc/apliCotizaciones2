// Orquesta la página: carga cada grupo de datos por separado. Si uno falla, los demás siguen funcionando.
import { obtener } from './api.js';
import { bloqueError, reemplazar } from './dom.js';
import { hora } from './formato.js';
import { pintarPizarra } from './vistas/pizarra.js';
import { pintarBancos } from './vistas/bancos.js';
import { pintarSitios } from './vistas/sitios.js';
import { pintarMonedas } from './vistas/monedas.js';
import { pintarIndicadores } from './vistas/indicadores.js';
import { iniciarConversor } from './vistas/conversor.js';

const REFRESCO_MS = 5 * 60_000;
const $ = (id) => document.getElementById(id);
let primeraVez = true;

// Cada carga: una ruta de la API y las secciones que se pintan con su respuesta
const cargas = [
  { ruta: '/cotizaciones', pintar: (d) => {
    pintarPizarra($('tablero-datos'), d, { primeraVez });
    pintarMonedas($('monedas-datos'), d);
  }, contenedores: ['tablero-datos', 'monedas-datos'] },
  { ruta: '/bancos', pintar: (d) => pintarBancos($('bancos-datos'), d), contenedores: ['bancos-datos'] },
  // Billeteras y sitios juntan dos rutas; si una falla se muestra la otra, y solo si fallan ambas aparece el error
  { obtener: async () => {
    const [billeteras, paralelo] = await Promise.allSettled([obtener('/billeteras'), obtener('/paralelo')]);
    if (billeteras.status === 'rejected' && paralelo.status === 'rejected') throw billeteras.reason;
    return { billeteras: billeteras.value ?? null, paralelo: paralelo.value ?? null };
  }, pintar: (d) => pintarSitios($('sitios-datos'), d), contenedores: ['sitios-datos'] },
  { ruta: '/indicadores', pintar: (d) => pintarIndicadores($('indicadores-datos'), d), contenedores: ['indicadores-datos'] },
];

async function ejecutar(carga) {
  try {
    carga.pintar(await (carga.obtener ? carga.obtener() : obtener(carga.ruta)));
    return true;
  } catch (error) {
    for (const id of carga.contenedores) {
      reemplazar($(id), bloqueError(error.message, () => ejecutar(carga)));
    }
    return false;
  }
}

async function actualizarTodo() {
  const boton = $('btn-actualizar');
  boton.disabled = true;
  const resultados = await Promise.all(cargas.map(ejecutar));
  primeraVez = false;
  boton.disabled = false;
  const todoBien = resultados.every(Boolean);
  $('actualizado').textContent = `${todoBien ? 'Actualizado' : 'Actualizado parcialmente'} a las ${hora(new Date())}`;
}

const convertir = iniciarConversor();
$('btn-actualizar').addEventListener('click', () => { actualizarTodo(); convertir(); });
actualizarTodo().then(convertir);
setInterval(() => { if (document.visibilityState === 'visible') actualizarTodo(); }, REFRESCO_MS);
