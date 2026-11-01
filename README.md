# apliCotizaciones2

Segundo prototipo (más avanzado) de apliCotizaciones. Proyecto de *Tecnologías Web II*.

**Estado (rama `prototipo3`):** Etapa 5: descarga CSV del histórico para usuarios con correo confirmado. Etapa 4: cuentas de usuario (registro, sesión, verificación de correo, recuperar/cambiar contraseña, eliminar cuenta). Etapa 3. Ruta `/historico` y gráfico de evolución diaria (oficial, paralelo o ambos; 7 días a 6 meses). Etapa 2: recolector programado que llena el histórico por su cuenta. Etapa 1 hecha: Airtm, Takenos, El Dorado y Bitget P2P. El prototipo 2 completo está en la etiqueta `v2.0`.

## Estructura

| Carpeta | Responsabilidad |
|---|---|
| `src/config` | Lee el entorno una vez y lo entrega como objeto |
| `src/contracts` | Contratos comunes (`Observacion`, `Adaptador`) |
| `src/adapters` | Una fuente externa por archivo (BCB, Frankfurter, Binance, dolarbluebolivia) |
| `src/repositories` | Acceso a PostgreSQL |
| `src/services` | Caché, cálculos, conversión, recolector |
| `src/routes` | Rutas Express (solo HTTP) |
| `src/middleware` | Errores, CORS, autenticación y defensa CSRF (luego helmet y límites) |
| `src/mailer` | Envío de correos intercambiable (hoy: imprime en consola) y plantillas de texto |
| `src/utilidades` | Contraseñas (scrypt), JWT, cookies y sesiones |
| `src/docs` | Especificación OpenAPI modular |
| `public` | Frontend sencillo |
| `db` | Esquema SQL y `migraciones/` |
| `tests` | Pruebas con `node --test` |

## Probar

```bash
npm install express pg dotenv
npm test
npm start   # luego abrir http://localhost:3000/health
npm run recolector   # proceso aparte: consulta las fuentes cada cierto tiempo (Ctrl+C para detener)
```

## Recolector

`npm run recolector` arranca un proceso independiente del servidor web que consulta cada fuente a intervalos y guarda cada lectura en PostgreSQL, para que el histórico se acumule aunque nadie abra la página. Los intervalos se cambian en `.env` (`RECOLECTOR_*_MIN`, en minutos; `0` desactiva esa tarea). Si una fuente falla, se registra y se reintenta en el siguiente intervalo; nunca hay dos lecturas simultáneas de la misma fuente. Con `Ctrl+C` termina la lectura en curso y se cierra ordenadamente.

## Cuentas de usuario

- **Migración:** ejecutar `db/migraciones/003_usuarios.sql` en la base existente (pgAdmin → Query Tool). Crea `usuarios` y `tokens_usuario`.
- **`.env`:** definir `JWT_SECRET` (mínimo 32 caracteres; el archivo `.env.example` explica cómo generarlo). Sin él, en desarrollo se usa uno temporal y las sesiones se cierran al reiniciar; en producción es obligatorio.
- **Correos:** por ahora se *imprimen en la terminal del servidor* (`MAIL_MODO=consola`). El enlace de confirmación o de recuperación se copia desde allí. Un mailer SMTP real llegará con las alertas (Etapa 6) sin tocar el resto del código.
- **Sesión:** JWT firmado (HS256) dentro de una cookie `httpOnly` + `SameSite=Strict` (+ `Secure` en producción). El JavaScript de la página nunca la ve. Cambiar o restablecer la contraseña cierra las demás sesiones.
- **Contraseñas:** hash scrypt con sal propia; mínimo 10 caracteres. **Tokens** de correo: aleatorios, de un solo uso, con vencimiento (24 h verificación, 60 min recuperación) y guardados solo como hash.
- **Contra abuso:** mensajes idénticos exista o no la cuenta, bloqueo de 15 min tras 5 intentos fallidos, comprobación de origen en peticiones que modifican datos. El límite de peticiones por IP llegará en la Etapa 8.
- **Rutas:** `/usuarios/registro`, `verificar`, `reenviar-verificacion`, `ingresar`, `salir`, `yo` (GET y DELETE), `cambiar-clave`, `recuperar`, `restablecer`. Detalle en `/docs`.
- **Roles:** cada usuario es `registrado`; el valor `premium` existe en la base pero aún no activa nada.

## Descarga CSV

`GET /historico.csv?serie=oficial|paralelo|ambos&dias=7|30|90|180&formato=excel|estandar` entrega los mismos datos del gráfico, una fila por día (`fecha`, `oficial_bs_por_usd`, `paralelo_venta_bs_por_usd`, `paralelo_compra_bs_por_usd`). Exige sesión iniciada y correo confirmado (401 / 403 si no). El formato `excel` (por defecto) usa `;`, decimales con coma y BOM UTF-8 para abrirlo con doble clic en Excel en español; `estandar` usa `,` y punto decimal. Si no hay cuentas configuradas, la ruta no se monta. En la página, el botón "Descargar CSV" está bajo el gráfico y respeta la serie y el período elegidos.

## Documentación y seguridad

- **Swagger UI:** http://localhost:3000/docs (la especificación está dividida en `src/docs/rutas/`, un archivo por grupo de rutas).
- **CORS:** por lista blanca en `CORS_ORIGINS` (separados por coma). Vacío = sin orígenes externos; el frontend va en el mismo origen y no lo necesita.
- **Ya aplicado:** consultas parametrizadas, validación por lista blanca, errores sin detalles internos, cuerpos JSON limitados a 10 kb, cabecera `X-Powered-By` desactivada, secretos en `.env`.
- **Pendiente (futuro):** `helmet` (cabeceras de seguridad y política de contenido; requiere ajustar Swagger UI), límite de peticiones, usuario de base de datos con privilegios mínimos, HTTPS en despliegue.
