# apliCotizaciones2

Segundo prototipo (más avanzado) de apliCotizaciones. Proyecto de *Tecnologías Web II*.

**Estado (rama `prototipo3`):** Etapa 8: seguridad (límite de peticiones, cabeceras y política de contenido, Chart.js propio, usuario de base con privilegios mínimos, prueba de correo). Etapa 6: alertas de precio por correo con un proceso notificador aparte (`npm run notificador`) y envío SMTP real (Gmail). Etapa 5: descarga CSV del histórico para usuarios con correo confirmado. Etapa 4: cuentas de usuario (registro, sesión, verificación de correo, recuperar/cambiar contraseña, eliminar cuenta). Etapa 3. Ruta `/historico` y gráfico de evolución diaria (oficial, paralelo o ambos; 7 días a 6 meses). Etapa 2: recolector programado que llena el histórico por su cuenta. Etapa 1 hecha: Airtm, Takenos, El Dorado y Bitget P2P. El prototipo 2 completo está en la etiqueta `v2.0`.

## Estructura

| Carpeta | Responsabilidad |
|---|---|
| `src/config` | Lee el entorno una vez y lo entrega como objeto |
| `src/contracts` | Contratos comunes (`Observacion`, `Adaptador`) |
| `src/adapters` | Una fuente externa por archivo (BCB, Frankfurter, Binance, dolarbluebolivia) |
| `src/repositories` | Acceso a PostgreSQL |
| `src/services` | Caché, cálculos, conversión, recolector |
| `src/routes` | Rutas Express (solo HTTP) |
| `src/middleware` | Errores, CORS, autenticación (sesión, correo confirmado, administrador), CSRF, límites, cabeceras y medición de uso |
| `src/mailer` | Envío de correos intercambiable (hoy: imprime en consola) y plantillas de texto |
| `src/utilidades` | Contraseñas (scrypt), JWT, cookies y sesiones |
| `src/docs` | Especificación OpenAPI modular |
| `public` | Frontend sencillo |
| `db` | Esquema SQL y `migraciones/` |
| `tests` | Pruebas con `node --test` |

## Probar

```bash
npm install
npm test
npm start   # luego abrir http://localhost:3000/health
npm run recolector   # proceso aparte: consulta las fuentes cada cierto tiempo (Ctrl+C para detener)
npm run notificador  # proceso aparte: revisa las alertas y envía los avisos por correo
```

## Recolector

`npm run recolector` arranca un proceso independiente del servidor web que consulta cada fuente a intervalos y guarda cada lectura en PostgreSQL, para que el histórico se acumule aunque nadie abra la página. Los intervalos se cambian en `.env` (`RECOLECTOR_*_MIN`, en minutos; `0` desactiva esa tarea). Si una fuente falla, se registra y se reintenta en el siguiente intervalo; nunca hay dos lecturas simultáneas de la misma fuente. Con `Ctrl+C` termina la lectura en curso y se cierra ordenadamente.

## Histórico real (importación)

Para que el gráfico no empiece vacío, se pueden traer series históricas públicas de dolarbluebolivia.click (oficial diario y paralelo de los últimos 6 meses):

1. `npm run datos:borrar-ficticios` (los datos ficticios ocuparían los días; el importador se niega a seguir si existen).
2. `npm run datos:importar -- --explorar` muestra qué trae la API, sin tocar la base.
3. `npm run datos:importar -- --simular` dice cuántas filas guardaría, sin guardar.
4. `npm run datos:importar` guarda: **un valor por día** (el último del día, hora de Bolivia), **solo en los días vacíos** (nunca pisa lo que guardó el recolector) y sin el día de hoy. Se puede repetir sin duplicar.
5. `npm run datos:importar -- --borrar` quita todo lo importado.

Lo importado se guarda con la fuente `dolarblue_historico`, separada de lo que recolecta el sistema en vivo. Es un tercero sin garantía: en el informe y la presentación hay que citar la fuente.

## Cuentas de usuario

- **Migración:** ejecutar `db/migraciones/003_usuarios.sql` en la base existente (pgAdmin → Query Tool). Crea `usuarios` y `tokens_usuario`.
- **`.env`:** definir `JWT_SECRET` (mínimo 32 caracteres; el archivo `.env.example` explica cómo generarlo). Sin él, en desarrollo se usa uno temporal y las sesiones se cierran al reiniciar; en producción es obligatorio.
- **Correos:** por ahora se *imprimen en la terminal del servidor* (`MAIL_MODO=consola`). El enlace de confirmación o de recuperación se copia desde allí. Un mailer SMTP real llegará con las alertas (Etapa 6) sin tocar el resto del código.
- **Sesión:** JWT firmado (HS256) dentro de una cookie `httpOnly` + `SameSite=Strict` (+ `Secure` en producción). El JavaScript de la página nunca la ve. Cambiar o restablecer la contraseña cierra las demás sesiones.
- **Contraseñas:** hash scrypt con sal propia; mínimo 10 caracteres. **Tokens** de correo: aleatorios, de un solo uso, con vencimiento (24 h verificación, 60 min recuperación) y guardados solo como hash.
- **Contra abuso:** mensajes idénticos exista o no la cuenta, bloqueo de 15 min tras 5 intentos fallidos, comprobación de origen en peticiones que modifican datos. El límite de peticiones por IP llegará en la Etapa 8.
- **Rutas:** `/usuarios/registro`, `verificar`, `reenviar-verificacion`, `ingresar`, `salir`, `yo` (GET y DELETE), `cambiar-clave`, `recuperar`, `restablecer`. Detalle en `/docs`.
- **Roles:** `registrado` (usuario común), `premium` (existe en la base, aún no activa nada) y `admin` (ve el panel de estadísticas; ver más abajo).

## Alertas por correo

- **Migración:** `db/migraciones/004_alertas.sql` (tabla `alertas`). **Dependencia nueva:** `nodemailer` (`npm install`).
- **Tipos:** `sube_de` y `baja_de` (precio en Bs, inclusivo) y `cambio_pct` (el precio cambió, hacia arriba o abajo, al menos ese % respecto al cierre del día anterior). Sobre el dólar oficial o el paralelo (venta o compra). Máximo de alertas por usuario: `ALERTAS_MAX` (3). Una alerta que ya avisó espera `ALERTAS_ENFRIAMIENTO_H` horas (12) antes de volver a avisar, aunque la condición siga cumpliéndose.
- **Quién:** solo usuarios con sesión y correo confirmado. Rutas `GET/POST /alertas`, `PATCH/DELETE /alertas/:id`. En la página: sección "Mis alertas".
- **Cómo funciona (microservicios ligeros):** el recolector guarda los precios en PostgreSQL; el notificador (`npm run notificador`, revisa cada `NOTIFICADOR_MIN` minutos, 5 por defecto) lee esos precios y los compara con las alertas activas. No se hablan entre sí, solo comparten la base: si uno se cae, el otro sigue. Los tres procesos (servidor, recolector, notificador) pueden ejecutarse por separado.
- **Sin duplicados ni pérdidas:** el aviso se "reclama" en la base antes de enviar el correo (solo un proceso puede hacerlo); si el envío falla, se devuelve la marca y se reintenta en la siguiente vuelta. Un dato desactualizado nunca dispara avisos.
- **Correo real con Gmail:** activa la verificación en dos pasos, crea una "contraseña de aplicación" (Cuenta Google → Seguridad) y en `.env` pon `MAIL_MODO=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USUARIO`, `SMTP_CLAVE` (la contraseña de aplicación) y opcionalmente `MAIL_FROM`. Al arrancar, el notificador verifica la conexión y se detiene con un mensaje claro si falla. Con `MAIL_MODO=consola` los avisos se imprimen en la terminal del notificador.

## Administrador y estadísticas (Etapa 9)

- **Migración:** `db/migraciones/005_admin.sql` (rol `admin`, tablas `uso_diario` y `avisos_enviados`). Si usas el usuario de base con privilegios mínimos, vuelve a ejecutar `db/seguridad_usuario_app.sql` para darle permiso sobre las tablas nuevas.
- **Crear el administrador (solo por terminal, nunca desde la web):** `npm run admin:crear -- correo@ejemplo.com` pide la contraseña (12 caracteres o más, no se muestra al escribir). Sin teclado, p. ej. en Docker: `ADMIN_CLAVE="..." npm run admin:crear -- correo@ejemplo.com`. Repetir el comando con el mismo correo **restablece su contraseña** y cierra sus sesiones. `npm run admin:crear -- correo@ejemplo.com --quitar` le devuelve el rol común. La contraseña nunca se pasa como argumento ni se guarda en `.env`.
- **Cómo entra:** con el mismo botón "Ingresar" de todos. Si la cuenta es de administrador, aparece arriba el "Panel de administración". Es solo comodidad: el servidor responde 403 en `GET /admin/estadisticas` a cualquiera que no tenga el rol (que se lee de la base en cada petición, así que quitarlo surte efecto al instante).
- **Qué muestra (solo totales, nunca correos):** personas registradas y confirmadas, altas por período y por rol, alertas activas, avisos enviados, peticiones a la API y descargas de CSV por día, rutas más pedidas, y cotizaciones guardadas por fuente. Períodos: 7, 30 o 90 días.
- **Cómo se mide el uso:** un medidor cuenta en memoria cada petición a la API (no los archivos de la página, ni `/admin`, ni `/health`) y vuelca los totales a `uso_diario` cada 30 segundos y al cerrar el servidor. Son contadores por día y ruta: no guardan IP ni datos de personas. Solo existen contadores desde que se activó la etapa; los días anteriores aparecen en cero. Las rutas desconocidas se agrupan en "(otras)" para que los contadores no crezcan sin límite.
- **Salvaguardas:** la cuenta de administrador no se puede eliminar desde la página; el ingreso es el de siempre (mismo mensaje de error, bloqueo tras 5 intentos, límite por IP).

## Artículos premium (Etapa 11)

- **Migración:** `db/migraciones/006_articulos.sql` crea la tabla `articulos` con **tres textos de prueba** (palabras de relleno). Para cambiarlos: pgAdmin → `articulos` → editar, o `UPDATE articulos SET titulo = '…', resumen = '…', cuerpo = '…' WHERE id = 1;`. El cuerpo es texto plano; una línea en blanco separa párrafos.
- **Quién lee qué:** `GET /articulos` es público (título, autor, fecha y resumen; nunca el cuerpo). `GET /articulos/:id` exige sesión y rol **premium** (o admin); un usuario común recibe 403 "Contenido para suscriptores premium".
- **Dar o quitar premium (sin pagos, solo por terminal):** `npm run usuario:rol -- correo@ejemplo.com premium` y `npm run usuario:rol -- correo@ejemplo.com registrado`. La cuenta debe existir; no se aplica a administradores. Rige al instante (el rol se lee de la base en cada petición).
- **En la página:** sección "Análisis y perspectivas" con tarjetas. Sin sesión o sin premium se ve el resumen con un candado; con premium, "Leer artículo" abre el texto completo. El texto se inserta como texto, nunca como HTML.
- **Guardia reutilizable:** `exigirRol(['premium', 'admin'])` en `src/middleware/autenticacion.js` (control de acceso basado en roles).

## Descarga CSV

`GET /historico.csv?serie=oficial|paralelo|ambos&dias=7|30|90|180&formato=excel|estandar` entrega los mismos datos del gráfico, una fila por día (`fecha`, `oficial_bs_por_usd`, `paralelo_venta_bs_por_usd`, `paralelo_compra_bs_por_usd`). Exige sesión iniciada y correo confirmado (401 / 403 si no). El formato `excel` (por defecto) usa `;`, decimales con coma y BOM UTF-8 para abrirlo con doble clic en Excel en español; `estandar` usa `,` y punto decimal. Si no hay cuentas configuradas, la ruta no se monta. En la página, el botón "Descargar CSV" está bajo el gráfico y respeta la serie y el período elegidos.

## Seguridad (Etapa 8)

| Medida | Dónde |
|---|---|
| Consultas SQL parametrizadas y validación por lista blanca | `src/repositories`, `src/routes/validacion.js` |
| Contraseñas con hash scrypt y sal; JWT en cookie `httpOnly` + `SameSite=Strict` (+ `Secure` en producción) | `src/utilidades/` |
| Defensa CSRF (cookie `SameSite` + comprobación de origen) | `src/middleware/autenticacion.js` |
| Mensajes idénticos exista o no la cuenta; bloqueo de 15 min tras 5 intentos fallidos; tokens de un solo uso con vencimiento, guardados como hash | `src/services/usuariosService.js` |
| **Límite de peticiones por IP** (y por correo destinatario en registro/recuperación) | `src/middleware/limitador.js` |
| **Cabeceras de seguridad** (política de contenido estricta, `nosniff`, `Referrer-Policy`, anti-marcos, HSTS con HTTPS) | `src/middleware/cabeceras.js` |
| **Sin recursos de terceros** salvo las fuentes de Google; Chart.js servido desde `public/vendor/` | `public/index.html` |
| **Usuario de base con privilegios mínimos** | `db/seguridad_usuario_app.sql` |
| Validación estricta de correos (evita colar destinatarios extra) | `src/routes/validacion.js` |
| Errores sin detalles internos, cuerpos JSON de máx. 10 kb, `X-Powered-By` desactivado, secretos solo en `.env` | `src/middleware/errores.js`, `src/app.js` |

- **Límite de peticiones:** 120 por minuto por IP en la API; 10 ingresos cada 15 min; 5 solicitudes de correo por hora por IP y 3 por destinatario; 30 descargas CSV por hora. Al excederse: respuesta 429 con `Retry-After`. Los contadores viven en la memoria del proceso (se reinician con él y, con varias copias del servidor, cada una cuenta aparte). `RATE_LIMIT=off` lo desactiva solo fuera de producción. Detrás de un proxy (nginx, la nube) hay que poner `TRUST_PROXY=1`.
- **Chart.js propio:** `npm install` y luego `npm run vendor` copian la librería a `public/vendor/chart.umd.js`; ese archivo se sube a git. Sin él, la página funciona y el gráfico muestra un aviso.
- **Usuario mínimo:** ejecutar `db/seguridad_usuario_app.sql` con el usuario administrador (cambiando la clave de ejemplo) y poner `DB_USER`/`DB_PASSWORD` del nuevo usuario en `.env`. Las migraciones y `npm run datos:ficticios` se siguen ejecutando como administrador.
- **Probar el correo:** `npm run correo:prueba -- tu_correo@gmail.com` verifica credenciales y envía un mensaje de prueba.
- **CORS:** por lista blanca en `CORS_ORIGINS`; vacío = solo mismo origen.
- **Límites conocidos:** sin HTTPS propio (hay que ponerlo delante con un proxy o la plataforma de despliegue); contadores de límites en memoria; Gmail como SMTP tiene tope diario; la política de `/docs` es más laxa porque Swagger UI necesita scripts y estilos en línea.

## Documentación

- **Swagger UI:** http://localhost:3000/docs (especificación dividida en `src/docs/rutas/`, un archivo por grupo de rutas).
