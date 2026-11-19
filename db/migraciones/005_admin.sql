-- Migración 005: administrador y estadísticas de uso. Segura de ejecutar varias veces.
-- En pgAdmin: Query Tool → pegar → F5.

-- 1) El rol "admin" (la restricción CHECK de la columna rol se llama usuarios_rol_check)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('registrado', 'premium', 'admin'));

-- 2) Contadores de uso: cuántas peticiones a la API (y cuántas descargas de CSV) hubo cada día, por ruta.
--    Son CONTADORES, no un registro por visita: no guardan IP, ni correo, ni nada de la persona.
CREATE TABLE IF NOT EXISTS uso_diario (
  dia    DATE   NOT NULL,                                          -- día en hora de Bolivia
  tipo   TEXT   NOT NULL CHECK (tipo IN ('peticion', 'descarga')),
  ruta   TEXT   NOT NULL,                                          -- ejemplo: /cotizaciones, /alertas/:id
  total  BIGINT NOT NULL DEFAULT 0 CHECK (total >= 0),
  PRIMARY KEY (dia, tipo, ruta)
);

-- 3) Avisos de alertas enviados (sin enlace al usuario: el conteo sobrevive aunque se borre la alerta o la cuenta)
CREATE TABLE IF NOT EXISTS avisos_enviados (
  id          BIGSERIAL PRIMARY KEY,
  enviado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  serie       TEXT NOT NULL,
  tipo        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS avisos_enviados_fecha ON avisos_enviados (enviado_en);
