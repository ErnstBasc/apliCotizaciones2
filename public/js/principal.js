// Orquesta la página: carga cada grupo de datos por separado. Si uno falla, los demás siguen funcionando.
import { obtener } from './api.js';
import { bloqueError, reemplazar } from './dom.js';
import { hora } from './formato.js';
import { pintarPizarra } from './vistas/pizarra.js';
import { pintarComparacion } from './vistas/comparacion.js';
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
  { ruta: '/comparacion', pintar: (d) => pintarComparacion($('comparacion-datos'), d), contenedores: ['comparacion-datos'] },
  { ruta: '/indicadores', pintar: (d) => pintarIndicadores($('indicadores-datos'), d), contenedores: ['indicadores-datos'] },
];

async function ejecutar(carga) {
  try {
    carga.pintar(await obtener(carga.ruta));
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
