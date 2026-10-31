# apliCotizaciones2

Segundo prototipo (más avanzado) de apliCotizaciones. Proyecto de *Tecnologías Web II*.

**Estado (rama `prototipo3`):** Etapa 2. Recolector programado que llena el histórico por su cuenta. Etapa 1 hecha: Airtm, Takenos, El Dorado y Bitget P2P. El prototipo 2 completo está en la etiqueta `v2.0`.

## Estructura

| Carpeta | Responsabilidad |
|---|---|
| `src/config` | Lee el entorno una vez y lo entrega como objeto |
| `src/contracts` | Contratos comunes (`Observacion`, `Adaptador`) |
| `src/adapters` | Una fuente externa por archivo (BCB, Frankfurter, Binance, dolarbluebolivia) |
| `src/repositories` | Acceso a PostgreSQL |
| `src/services` | Caché, cálculos, conversión, recolector |
| `src/routes` | Rutas Express (solo HTTP) |
| `src/middleware` | Errores, seguridad (helmet, CORS, límites) |
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

## Documentación y seguridad

- **Swagger UI:** http://localhost:3000/docs (la especificación está dividida en `src/docs/rutas/`, un archivo por grupo de rutas).
- **CORS:** por lista blanca en `CORS_ORIGINS` (separados por coma). Vacío = sin orígenes externos; el frontend va en el mismo origen y no lo necesita.
- **Ya aplicado:** consultas parametrizadas, validación por lista blanca, errores sin detalles internos, cuerpos JSON limitados a 10 kb, cabecera `X-Powered-By` desactivada, secretos en `.env`.
- **Pendiente (futuro):** `helmet` (cabeceras de seguridad y política de contenido; requiere ajustar Swagger UI), límite de peticiones, usuario de base de datos con privilegios mínimos, HTTPS en despliegue.
