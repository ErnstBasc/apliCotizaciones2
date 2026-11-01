// Cuenta de usuario en una ventana emergente (<dialog>): ingresar, registrarse, recuperar contraseña, cambiarla y eliminar la cuenta.
// Toda la lógica de seguridad vive en el servidor; aquí solo se arman formularios y se muestran mensajes.
// La sesión es una cookie httpOnly: este código NUNCA la ve ni la toca. Para saber quién es el usuario pregunta a /usuarios/yo.
import { obtener, enviar } from '../api.js';
import { el } from '../dom.js';

const $ = (id) => document.getElementById(id);
let usuario = null;

// ---------- piezas de formulario ----------
function campo({ id, etiqueta, tipo = 'text', autocompletar, ayuda, minimo }) {
  return el('div', { class: 'campo' },
    el('label', { for: id }, etiqueta),
    el('input', { id, name: id, type: tipo, autocomplete: autocompletar, required: true, minlength: minimo, maxlength: tipo === 'email' ? 254 : 128, 'aria-describedby': ayuda ? `${id}-ayuda` : null }),
    ayuda && el('p', { id: `${id}-ayuda`, class: 'ayuda-campo' }, ayuda));
}

// Formulario con botón que se bloquea mientras se envía y un área de error accesible
function formulario({ campos, texto, alEnviar, clase = 'boton-principal' }) {
  const error = el('p', { class: 'error-campo', role: 'alert' });
  const boton = el('button', { type: 'submit', class: `boton ${clase}` }, texto);
  const f = el('form', { class: 'formulario', novalidate: false }, campos, error, boton);
  f.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    error.textContent = '';
    boton.disabled = true;
    try {
      await alEnviar(Object.fromEntries(new FormData(f)));
    } catch (e) {
      error.textContent = e.message;
    } finally {
      boton.disabled = false;
    }
  });
  return f;
}

const enlaceTexto = (texto, alClic) => el('button', { type: 'button', class: 'boton-texto', onclick: alClic }, texto);
const parrafo = (texto, clase) => el('p', { class: clase }, texto);

// ---------- el diálogo ----------
function mostrar(titulo, ...contenido) {
  $('dialogo-titulo').textContent = titulo;
  $('dialogo-contenido').replaceChildren(...contenido.flat().filter(Boolean));
  const dialogo = $('dialogo-cuenta');
  if (!dialogo.open) dialogo.showModal();
  const primero = $('dialogo-contenido').querySelector('input, button');
  (primero || $('dialogo-titulo')).focus();
}
const cerrar = () => { const d = $('dialogo-cuenta'); if (d.open) d.close(); };

function mensaje(titulo, texto, ...extra) {
  mostrar(titulo, parrafo(texto, 'dialogo-texto'), ...extra, el('button', { type: 'button', class: 'boton boton-principal', onclick: cerrar }, 'Entendido'));
}

// ---------- vistas ----------
function pestanas(activa) {
  const pestana = (nombre, etiqueta, ir) => el('button', {
    type: 'button', role: 'tab', class: 'pestana', 'aria-selected': String(activa === nombre), onclick: ir,
  }, etiqueta);
  return el('div', { class: 'pestanas', role: 'tablist' },
    pestana('ingresar', 'Ingresar', () => vistaIngreso()), pestana('registro', 'Registrarse', () => vistaRegistro()));
}

function vistaIngreso(aviso) {
  mostrar('Tu cuenta',
    pestanas('ingresar'),
    aviso && parrafo(aviso, 'aviso-ok'),
    formulario({
      texto: 'Ingresar',
      campos: [
        campo({ id: 'correo', etiqueta: 'Correo', tipo: 'email', autocompletar: 'username' }),
        campo({ id: 'clave', etiqueta: 'Contraseña', tipo: 'password', autocompletar: 'current-password' }),
      ],
      alEnviar: async (d) => {
        const r = await enviar('/usuarios/ingresar', { correo: d.correo, clave: d.clave });
        fijarUsuario(r.usuario);
        cerrar();
      },
    }),
    el('div', { class: 'enlaces-dialogo' }, enlaceTexto('Olvidé mi contraseña', () => vistaRecuperar())));
}

function vistaRegistro() {
  mostrar('Tu cuenta',
    pestanas('registro'),
    parrafo('Con una cuenta podrás descargar datos en CSV y recibir alertas por correo.', 'dialogo-texto'),
    formulario({
      texto: 'Crear cuenta',
      campos: [
        campo({ id: 'correo', etiqueta: 'Correo', tipo: 'email', autocompletar: 'username' }),
        campo({ id: 'clave', etiqueta: 'Contraseña', tipo: 'password', autocompletar: 'new-password', minimo: 10, ayuda: 'Mínimo 10 caracteres. Una frase larga es mejor que una palabra con símbolos.' }),
      ],
      alEnviar: async (d) => {
        const r = await enviar('/usuarios/registro', { correo: d.correo, clave: d.clave });
        mensaje('Revisa tu correo', r.mensaje, parrafo('El enlace de confirmación vence en 24 horas.', 'dialogo-texto'));
      },
    }));
}

function vistaRecuperar() {
  mostrar('Recuperar contraseña',
    parrafo('Escribe tu correo y te enviaremos un enlace para elegir una contraseña nueva.', 'dialogo-texto'),
    formulario({
      texto: 'Enviar enlace',
      campos: [campo({ id: 'correo', etiqueta: 'Correo', tipo: 'email', autocompletar: 'username' })],
      alEnviar: async (d) => {
        const r = await enviar('/usuarios/recuperar', { correo: d.correo });
        mensaje('Revisa tu correo', r.mensaje);
      },
    }),
    el('div', { class: 'enlaces-dialogo' }, enlaceTexto('Volver', () => vistaIngreso())));
}

function vistaRestablecer(token) {
  mostrar('Contraseña nueva',
    formulario({
      texto: 'Guardar contraseña',
      campos: [campo({ id: 'clave', etiqueta: 'Contraseña nueva', tipo: 'password', autocompletar: 'new-password', minimo: 10, ayuda: 'Mínimo 10 caracteres.' })],
      alEnviar: async (d) => {
        await enviar('/usuarios/restablecer', { token, clave: d.clave });
        vistaIngreso('Contraseña actualizada. Ingresa con la nueva.');
      },
    }));
}

function vistaCuenta() {
  const aviso = usuario.verificado
    ? parrafo('Correo confirmado ✓', 'aviso-ok')
    : el('div', { class: 'aviso-pendiente' },
      parrafo('Falta confirmar tu correo. Hasta entonces no podrás descargar CSV ni crear alertas.'),
      enlaceTexto('Reenviar enlace de confirmación', async (e) => {
        e.currentTarget.disabled = true;
        try {
          const r = await enviar('/usuarios/reenviar-verificacion', { correo: usuario.correo });
          mensaje('Revisa tu correo', r.mensaje);
        } catch (err) { mensaje('No se pudo enviar', err.message); }
      }));

  mostrar('Tu cuenta',
    parrafo(usuario.correo, 'cuenta-correo'),
    aviso,
    el('div', { class: 'acciones-cuenta' },
      el('button', { type: 'button', class: 'boton boton-suave', onclick: vistaCambiarClave }, 'Cambiar contraseña'),
      el('button', { type: 'button', class: 'boton boton-suave', onclick: salir }, 'Cerrar sesión'),
      el('button', { type: 'button', class: 'boton boton-peligro-suave', onclick: vistaEliminar }, 'Eliminar mi cuenta')));
}

function vistaCambiarClave() {
  mostrar('Cambiar contraseña',
    formulario({
      texto: 'Cambiar contraseña',
      campos: [
        campo({ id: 'claveActual', etiqueta: 'Contraseña actual', tipo: 'password', autocompletar: 'current-password' }),
        campo({ id: 'claveNueva', etiqueta: 'Contraseña nueva', tipo: 'password', autocompletar: 'new-password', minimo: 10, ayuda: 'Mínimo 10 caracteres. Se cerrarán tus otras sesiones abiertas.' }),
      ],
      alEnviar: async (d) => {
        const r = await enviar('/usuarios/cambiar-clave', { claveActual: d.claveActual, claveNueva: d.claveNueva });
        mensaje('Listo', r.mensaje);
      },
    }),
    el('div', { class: 'enlaces-dialogo' }, enlaceTexto('Volver', vistaCuenta)));
}

function vistaEliminar() {
  mostrar('Eliminar mi cuenta',
    parrafo('Se borrarán tu cuenta y tus datos de forma definitiva. No se puede deshacer.', 'dialogo-texto aviso-peligro'),
    formulario({
      texto: 'Eliminar definitivamente',
      clase: 'boton-peligro',
      campos: [campo({ id: 'clave', etiqueta: 'Escribe tu contraseña para confirmar', tipo: 'password', autocompletar: 'current-password' })],
      alEnviar: async (d) => {
        const r = await enviar('/usuarios/yo', { clave: d.clave }, 'DELETE');
        fijarUsuario(null);
        mensaje('Cuenta eliminada', r.mensaje);
      },
    }),
    el('div', { class: 'enlaces-dialogo' }, enlaceTexto('Cancelar', vistaCuenta)));
}

async function salir() {
  try { await enviar('/usuarios/salir'); } catch { /* aunque falle, se muestra como desconectado: la cookie caduca sola */ }
  fijarUsuario(null);
  cerrar();
}

// ---------- estado ----------
function fijarUsuario(nuevo) {
  usuario = nuevo;
  $('btn-cuenta').textContent = usuario ? usuario.correo : 'Ingresar';
  $('btn-cuenta').classList.toggle('boton-cuenta-activa', Boolean(usuario));
  // Otras partes de la página (CSV, alertas…) pueden escuchar este evento para mostrarse u ocultarse
  document.dispatchEvent(new CustomEvent('sesion-cambiada', { detail: usuario }));
}

async function consultarSesion() {
  try { fijarUsuario((await obtener('/usuarios/yo')).usuario); } catch { fijarUsuario(null); }
}

// Los enlaces de los correos llegan como /?verificar=CODIGO o /?restablecer=CODIGO. Se leen y se quitan de la barra
// de direcciones de inmediato, para que el código no quede en el historial ni se copie sin querer.
async function atenderEnlaceDeCorreo() {
  const params = new URLSearchParams(location.search);
  const verificar = params.get('verificar');
  const restablecer = params.get('restablecer');
  if (!verificar && !restablecer) return;
  history.replaceState(null, '', location.pathname);
  if (restablecer) return vistaRestablecer(restablecer);
  try {
    const r = await enviar('/usuarios/verificar', { token: verificar });
    await consultarSesion();
    mensaje('Correo confirmado', r.mensaje);
  } catch (e) {
    mensaje('No se pudo confirmar', e.message, parrafo('Puedes pedir un enlace nuevo desde tu cuenta.', 'dialogo-texto'));
  }
}

// Para otras partes de la página (la descarga CSV, luego las alertas)
export const usuarioActual = () => usuario;
export const abrirCuenta = () => (usuario ? vistaCuenta() : vistaIngreso());

export async function iniciarCuenta() {
  $('btn-cuenta').addEventListener('click', abrirCuenta);
  $('dialogo-cerrar').addEventListener('click', cerrar);
  // Clic en el fondo oscuro (fuera de la caja) cierra
  $('dialogo-cuenta').addEventListener('click', (e) => { if (e.target === e.currentTarget) cerrar(); });
  await consultarSesion();
  await atenderEnlaceDeCorreo();
}
