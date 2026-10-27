// Construye elementos con textContent (nunca innerHTML): lo que llega de la API jamás se interpreta como HTML.
export function el(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'class') nodo.className = valor;
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

export function reemplazar(contenedor, ...nodos) {
  contenedor.replaceChildren(...nodos.flat().filter(Boolean));
}

// Bloque estándar de error con botón para reintentar
export function bloqueError(mensaje, alReintentar) {
  return el('div', { class: 'error', role: 'alert' },
    el('p', {}, `No se pudo cargar esta sección. ${mensaje}`),
    el('button', { type: 'button', class: 'boton boton-suave', onclick: alReintentar }, 'Reintentar'));
}
