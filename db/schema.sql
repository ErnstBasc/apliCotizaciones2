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
  ('dolarbluebolivia', 'dolarbluebolivia.click',    'https://api.dolarbluebolivia.click')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO entidades (codigo, nombre, tipo, web) VALUES
  ('bcb',        'Banco Central de Bolivia', 'organismo', 'https://www.bcb.gob.bo'),
  ('binance',    'Binance P2P',              'exchange',  'https://p2p.binance.com'),
  ('wallbit',    'Wallbit',                  'billetera', 'https://wallbit.io'),
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
