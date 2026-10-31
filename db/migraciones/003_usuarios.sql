-- Migración 003: usuarios y tokens de un solo uso (verificar correo, recuperar contraseña).
-- Segura de ejecutar varias veces. Ejecútala en tu base de datos existente (en pgAdmin: Query Tool → pegar → F5).
CREATE TABLE IF NOT EXISTS usuarios (
  id                 BIGSERIAL PRIMARY KEY,
  correo             TEXT NOT NULL,
  clave_hash         TEXT NOT NULL,                       -- hash scrypt con sal; la contraseña NUNCA se guarda
  rol                TEXT NOT NULL DEFAULT 'registrado' CHECK (rol IN ('registrado', 'premium')),
  verificado_en      TIMESTAMPTZ,                         -- NULL = correo sin confirmar
  intentos_fallidos  INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta    TIMESTAMPTZ,                         -- bloqueo temporal tras demasiados intentos
  version_sesion     INTEGER NOT NULL DEFAULT 0,          -- subirla invalida todas las sesiones abiertas
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_correo_minuscula CHECK (correo = lower(correo))
);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_correo_unico ON usuarios (correo);

CREATE TABLE IF NOT EXISTS tokens_usuario (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('verificacion', 'recuperacion')),
  token_hash  TEXT NOT NULL UNIQUE,                       -- se guarda el SHA-256 del token, nunca el token
  expira_en   TIMESTAMPTZ NOT NULL,
  usado_en    TIMESTAMPTZ,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tokens_usuario_por_usuario ON tokens_usuario (usuario_id, tipo);
