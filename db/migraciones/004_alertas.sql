-- Migración 004: alertas de precio por correo. Segura de ejecutar varias veces.
-- En pgAdmin: Query Tool → pegar → F5.
CREATE TABLE IF NOT EXISTS alertas (
  id               BIGSERIAL PRIMARY KEY,
  usuario_id       BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,  -- al borrar la cuenta se borran sus alertas
  serie            TEXT NOT NULL CHECK (serie IN ('oficial', 'paralelo')),
  lado             TEXT NOT NULL DEFAULT 'venta' CHECK (lado IN ('venta', 'compra')),
  tipo             TEXT NOT NULL CHECK (tipo IN ('sube_de', 'baja_de', 'cambio_pct')),
  umbral           NUMERIC(10, 2) NOT NULL CHECK (umbral > 0),                 -- Bs (sube_de, baja_de) o % (cambio_pct)
  activa           BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_aviso_en  TIMESTAMPTZ,                                                -- para no repetir avisos antes de tiempo
  creada_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alertas_por_usuario ON alertas (usuario_id);
CREATE INDEX IF NOT EXISTS alertas_activas ON alertas (activa) WHERE activa;
