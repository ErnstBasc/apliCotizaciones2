# apliCotizaciones2

Segundo prototipo (más avanzado) de apliCotizaciones. Proyecto de *Tecnologías Web II*.

**Estado:** Paso 6. Fuentes completas de la Fase A: Frankfurter (con PYG), BCB (oficial, oro, UFV, inflación), paralelo (Binance con respaldo), Wallbit y bancos. Rutas `/health`, `/monedas`, `/oficial`, `/paralelo`, `/indicadores`, `/billeteras` y `/bancos`.

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
