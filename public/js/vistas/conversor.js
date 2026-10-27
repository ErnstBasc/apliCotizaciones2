// Conversor: arma el formulario y llama a /convertir. El servidor valida; aquí solo se facilita la escritura.
import { el, reemplazar } from '../dom.js';
import { obtener } from '../api.js';
import { bs, normalizarMonto } from '../formato.js';

const MONEDAS = [
  ['USD', 'Dólar'], ['BOB', 'Boliviano'], ['EUR', 'Euro'], ['ARS', 'Peso argentino'],
  ['BRL', 'Real brasileño'], ['CLP', 'Peso chileno'], ['PEN', 'Sol peruano'], ['PYG', 'Guaraní paraguayo'],
];

export function iniciarConversor() {
  const form = document.getElementById('form-conversor');
  const resultado = document.getElementById('resultado');
  const de = form.elements.de;
  const a = form.elements.a;
  const opcionesBob = document.getElementById('opciones-bob');

  for (const select of [de, a]) {
    select.replaceChildren(...MONEDAS.map(([codigo, nombre]) => el('option', { value: codigo }, `${codigo}, ${nombre}`)));
  }
  de.value = 'USD';
  a.value = 'BOB';

  const actualizarOpciones = () => { opcionesBob.hidden = !(de.value === 'BOB' || a.value === 'BOB'); };

  async function convertir() {
    const parametros = new URLSearchParams({
      monto: normalizarMonto(form.elements.monto.value), de: de.value, a: a.value,
      tasa: form.elements.tasa.value, lado: form.elements.lado.value,
    });
    reemplazar(resultado, el('p', { class: 'cargando' }, 'Calculando…'));
    try {
      const r = await obtener(`/convertir?${parametros}`);
      const usaBob = r.de === 'BOB' || r.a === 'BOB';
      reemplazar(resultado,
        el('p', { class: 'resultado-cifra' }, `${r.resultado.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: 'always' })} ${r.a}`),
        el('p', { class: 'resultado-detalle' },
          `${bs(r.monto)} ${r.de}`, usaBob ? ` al tipo ${r.tasa}, precio de ${r.lado}` : ' pasando por el dólar',
          r.desactualizado ? '. Algún dato está desactualizado.' : '.'));
    } catch (error) {
      reemplazar(resultado, el('p', { class: 'resultado-error', role: 'alert' }, error.message));
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); convertir(); });
  form.addEventListener('change', actualizarOpciones);
  document.getElementById('invertir').addEventListener('click', () => {
    [de.value, a.value] = [a.value, de.value];
    actualizarOpciones();
    convertir();
  });

  actualizarOpciones();
  return convertir;
}
