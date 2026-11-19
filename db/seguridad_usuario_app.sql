-- Usuario de base de datos con PRIVILEGIOS MÍNIMOS para la aplicación (servidor, recolector y notificador).
-- Por qué: si alguien lograra inyectar SQL o robar el .env, con "postgres" podría borrar o leer TODO el servidor de bases de datos.
-- Con este usuario solo puede hacer lo que la aplicación necesita, y nada más (no crea ni borra tablas, no toca otras bases).
--
-- CÓMO USARLO (en pgAdmin, Query Tool conectado a tu base con tu usuario administrador):
--   1) Cambia 'CAMBIAR_ESTA_CLAVE' (abajo) por una contraseña larga y propia.
--   2) Si tu base no se llama aplicotizaciones2, cambia el nombre en la línea GRANT CONNECT.
--   3) Ejecuta todo (F5). En .env pon DB_USER=aplicotizaciones_app y DB_PASSWORD=<la clave nueva>.
-- Las migraciones y los scripts de datos ficticios se siguen ejecutando con tu usuario administrador.

-- 1) El usuario: puede iniciar sesión, pero no es superusuario ni puede crear bases ni roles
CREATE ROLE aplicotizaciones_app LOGIN PASSWORD 'CAMBIAR_ESTA_CLAVE'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

-- 2) Entrar a SU base y ver el esquema (sin permiso de crear objetos)
GRANT CONNECT ON DATABASE aplicotizaciones2 TO aplicotizaciones_app;
GRANT USAGE ON SCHEMA public TO aplicotizaciones_app;

-- 3) Tablas de referencia: solo lectura
GRANT SELECT ON fuentes, entidades, instrumentos TO aplicotizaciones_app;

-- 4) Cotizaciones: leer y agregar lecturas (nunca se modifican ni se borran desde la aplicación)
GRANT SELECT, INSERT ON cotizaciones TO aplicotizaciones_app;

-- 5) Cuentas y alertas: lo que cada módulo necesita
GRANT SELECT, INSERT, UPDATE, DELETE ON usuarios TO aplicotizaciones_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tokens_usuario TO aplicotizaciones_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON alertas TO aplicotizaciones_app;

-- 6) Estadísticas del administrador: contadores de uso (se suman, no se borran) y avisos enviados (solo se agregan)
GRANT SELECT, INSERT, UPDATE ON uso_diario TO aplicotizaciones_app;
GRANT SELECT, INSERT ON avisos_enviados TO aplicotizaciones_app;

-- 7) Los contadores automáticos (id) de las tablas donde se inserta
GRANT USAGE, SELECT ON SEQUENCE cotizaciones_id_seq, usuarios_id_seq, tokens_usuario_id_seq, alertas_id_seq, avisos_enviados_id_seq TO aplicotizaciones_app;

-- Para comprobarlo, ejecuta conectado como aplicotizaciones_app (debe dar error "permission denied"):
--   DROP TABLE alertas;
--   DELETE FROM cotizaciones;
