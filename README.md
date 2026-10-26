# apliCotizaciones2

Segundo prototipo (más avanzado) de apliCotizaciones. Proyecto de *Tecnologías Web II*.

**Estado:** Paso 8. Documentación Swagger modular en `/docs`, CORS por lista blanca y todas las rutas de la Fase A.

## Estructura

| Carpeta | Responsabilidad |
|---|---|
| `src/config` | Lee el entorno una vez y lo entrega como objeto |
| `src/contracts` | Contratos comunes (`Observacion`, `Adaptador`) |
| `src/adapters` | Una fuente externa por archivo (BCB, Frankfurter, Binance, dolarbluebolivia) |
| `src/repositories` | Acceso a PostgreSQL |
| `src/services` | Caché, cálculos, conversión |
| `src/routes` | Rutas Express (solo HTTP) |
| `src/middleware` | Errores, seguridad (helmet, CORS, límites) |
| `src/docs` | Especificación OpenAPI modular |
| `public` | Frontend sencillo |
| `db` | Esquema SQL |
| `tests` | Pruebas con `node --test` |

## Probar

```bash
npm install express pg dotenv
npm test
npm start   # luego abrir http://localhost:3000/health
```

## Documentación y seguridad

- **Swagger UI:** http://localhost:3000/docs (la especificación está dividida en `src/docs/rutas/`, un archivo por grupo de rutas).
- **CORS:** por lista blanca en `CORS_ORIGINS` (separados por coma). Vacío = sin orígenes externos; el frontend va en el mismo origen y no lo necesita.
- **Ya aplicado:** consultas parametrizadas, validación por lista blanca, errores sin detalles internos, cuerpos JSON limitados a 10 kb, cabecera `X-Powered-By` desactivada, secretos en `.env`.
- **Pendiente (futuro):** `helmet` (cabeceras de seguridad y política de contenido; requiere ajustar Swagger UI), límite de peticiones, usuario de base de datos con privilegios mínimos, HTTPS en despliegue.
