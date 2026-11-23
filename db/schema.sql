-- apliCotizaciones2 · Fase A (cotizaciones). Las tablas de usuarios y alertas llegan en la Fase B.
-- Crear la base:  CREATE DATABASE aplicotizaciones2;   y luego ejecutar este archivo sobre ella.

-- DE DÓNDE obtuvimos el dato (BCB, Frankfurter, Binance, dolarbluebolivia…)
CREATE TABLE IF NOT EXISTS fuentes (
  id      SERIAL PRIMARY KEY,
  codigo  TEXT UNIQUE NOT NULL,
  nombre  TEXT NOT NULL,
  url     TEXT
);

-- QUIÉN cotiza (un banco, una billetera, un exchange, el BCB). Puede ser distinta de la fuente:
-- el dato del Banco FIE lo obtenemos de la fuente "dolarbluebolivia".
CREATE TABLE IF NOT EXISTS entidades (
  id      SERIAL PRIMARY KEY,
  codigo  TEXT UNIQUE NOT NULL,
  nombre  TEXT NOT NULL,
  tipo    TEXT NOT NULL CHECK (tipo IN ('banco', 'billetera', 'exchange', 'organismo')),
  web     TEXT
);

-- QUÉ se cotiza
CREATE TABLE IF NOT EXISTS instrumentos (
  id       SERIAL PRIMARY KEY,
  codigo   TEXT UNIQUE NOT NULL,
  nombre   TEXT NOT NULL,
  tipo     TEXT NOT NULL CHECK (tipo IN ('moneda', 'tipo_cambio', 'materia_prima', 'indice')),
  unidad   TEXT NOT NULL
);

-- Cada lectura queda guardada (nunca se sobrescribe): sirve de caché, de respaldo y de histórico.
CREATE TABLE IF NOT EXISTS cotizaciones (
  id             BIGSERIAL PRIMARY KEY,
  instrumento_id INTEGER NOT NULL REFERENCES instrumentos(id),
  entidad_id     INTEGER REFERENCES entidades(id),
  fuente_id      INTEGER NOT NULL REFERENCES fuentes(id),
  valor          NUMERIC(18, 6),
  compra         NUMERIC(18, 6),
  venta          NUMERIC(18, 6),
  estado         TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'desactualizado')),
  fecha_fuente   DATE,
  obtenido_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_ultima
  ON cotizaciones (instrumento_id, entidad_id, obtenido_en DESC);

-- ---------- Datos iniciales ----------
INSERT INTO fuentes (codigo, nombre, url) VALUES
  ('bcb',              'Banco Central de Bolivia',  'https://www.bcb.gob.bo'),
  ('frankfurter',      'Frankfurter',               'https://api.frankfurter.dev'),
  ('binance',          'Binance P2P (no oficial)',  'https://p2p.binance.com'),
  ('dolarbluebolivia', 'dolarbluebolivia.click',    'https://api.dolarbluebolivia.click'),
  ('dolarblue_historico', 'dolarbluebolivia.click (histórico importado)', 'https://dolarbluebolivia.click')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO entidades (codigo, nombre, tipo, web) VALUES
  ('bcb',        'Banco Central de Bolivia', 'organismo', 'https://www.bcb.gob.bo'),
  ('binance',    'Binance P2P',              'exchange',  'https://p2p.binance.com'),
  ('wallbit',    'Wallbit',                  'billetera', 'https://wallbit.io'),
  ('airtm',      'Airtm',                    'billetera', 'https://www.airtm.com'),
  ('takenos',    'Takenos',                  'billetera', 'https://takenos.com'),
  ('eldorado',   'El Dorado',                'exchange',  'https://eldorado.io'),
  ('bitget',     'Bitget P2P',               'exchange',  'https://www.bitget.com'),
  ('fie',        'Banco FIE',                'banco',     'https://www.bancofie.com.bo/'),
  ('bisa',       'Banco Bisa',               'banco',     'https://www.bisa.com/'),
  ('bcp',        'BCP',                      'banco',     'https://www.bcp.com.bo/'),
  ('bnb',        'BNB',                      'banco',     'https://www.bnb.com.bo/'),
  ('fortaleza',  'Banco Fortaleza',          'banco',     'https://www.bancofortaleza.com.bo/'),
  ('ganadero',   'Banco Ganadero',           'banco',     'https://www.bg.com.bo/'),
  ('union',      'Banco Unión',              'banco',     'https://www.bancounion.com.bo/'),
  ('bancosol',   'BancoSol',                 'banco',     'https://www.bancosol.com.bo/'),
  ('mercantil',  'Mercantil Santa Cruz',     'banco',     'https://www.bmsc.com.bo/'),
  ('economico',  'Banco Económico',          'banco',     'https://www.baneco.com.bo/'),
  ('prodem',     'Banco Prodem',             'banco',     'https://www.prodem.bo/')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO instrumentos (codigo, nombre, tipo, unidad) VALUES
  ('BOB_OFICIAL',        'Dólar oficial (BCB)',        'tipo_cambio',   'Bs por USD'),
  ('BOB_PARALELO',       'Dólar paralelo (Binance)',   'tipo_cambio',   'Bs por USD'),
  ('BOB_BILLETERA',      'Dólar en billeteras',        'tipo_cambio',   'Bs por USD'),
  ('BOB_BANCO',          'Dólar en bancos (pizarra)',  'tipo_cambio',   'Bs por USD'),
  ('EUR',                'Euro',                       'moneda',        'por USD'),
  ('CLP',                'Peso chileno',               'moneda',        'por USD'),
  ('ARS',                'Peso argentino',             'moneda',        'por USD'),
  ('PEN',                'Sol peruano',                'moneda',        'por USD'),
  ('BRL',                'Real brasileño',             'moneda',        'por USD'),
  ('PYG',                'Guaraní paraguayo',          'moneda',        'por USD'),
  ('ORO',                'Oro',                        'materia_prima', 'USD por onza troy'),
  ('UFV',                'Unidad de Fomento a la Vivienda', 'indice',   'Bs por UFV'),
  ('INFLACION_MENSUAL',  'Inflación mensual (IPC)',    'indice',        '%'),
  ('INFLACION_12M',      'Inflación a 12 meses (IPC)', 'indice',        '%')
ON CONFLICT (codigo) DO NOTHING;

-- ===== Usuarios (Etapa 4) =====
CREATE TABLE IF NOT EXISTS usuarios (
  id                 BIGSERIAL PRIMARY KEY,
  correo             TEXT NOT NULL,
  clave_hash         TEXT NOT NULL,                       -- hash scrypt con sal; la contraseña NUNCA se guarda
  rol                TEXT NOT NULL DEFAULT 'registrado' CHECK (rol IN ('registrado', 'premium', 'admin')),
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

-- ===== Alertas (Etapa 6) =====
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

-- ---------- Administrador y estadísticas (migración 005) ----------
-- Contadores de uso: cuántas peticiones a la API (y cuántas descargas de CSV) hubo cada día, por ruta.
--    Son CONTADORES, no un registro por visita: no guardan IP, ni correo, ni nada de la persona.
CREATE TABLE IF NOT EXISTS uso_diario (
  dia    DATE   NOT NULL,                                          -- día en hora de Bolivia
  tipo   TEXT   NOT NULL CHECK (tipo IN ('peticion', 'descarga')),
  ruta   TEXT   NOT NULL,                                          -- ejemplo: /cotizaciones, /alertas/:id
  total  BIGINT NOT NULL DEFAULT 0 CHECK (total >= 0),
  PRIMARY KEY (dia, tipo, ruta)
);

-- Avisos de alertas enviados (sin enlace al usuario: el conteo sobrevive aunque se borre la alerta o la cuenta)
CREATE TABLE IF NOT EXISTS avisos_enviados (
  id          BIGSERIAL PRIMARY KEY,
  enviado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  serie       TEXT NOT NULL,
  tipo        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS avisos_enviados_fecha ON avisos_enviados (enviado_en);

-- ---------- Artículos premium (migración 006) ----------
CREATE TABLE IF NOT EXISTS articulos (
  id            SERIAL PRIMARY KEY,
  titulo        TEXT NOT NULL UNIQUE CHECK (length(titulo) BETWEEN 3 AND 200),
  autor         TEXT NOT NULL,
  resumen       TEXT NOT NULL,                 -- público
  cuerpo        TEXT NOT NULL,                 -- solo premium. Párrafos separados por una línea en blanco. Texto plano, no HTML.
  publicado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tres textos DE PRUEBA (palabras de relleno). Cámbialos con UPDATE o desde pgAdmin.
INSERT INTO articulos (titulo, autor, resumen, cuerpo, publicado_en) VALUES
  ('Perspectivas del tipo de cambio (texto de prueba)', 'Autor de prueba',
   'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.',
   'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
   '2026-11-20 10:00:00-04'),
  ('La brecha entre el oficial y el paralelo (texto de prueba)', 'Autor de prueba',
   'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque.',
   'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.',
   '2026-11-21 10:00:00-04'),
  ('Cómo leer el gráfico histórico (texto de prueba)', 'Autor de prueba',
   'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium.',
   'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio.',
   '2026-11-22 10:00:00-04')
ON CONFLICT (titulo) DO NOTHING;
