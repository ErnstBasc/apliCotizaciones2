-- Migración 002: nuevas plataformas del dólar (Airtm, Takenos, El Dorado y Bitget P2P).
-- Es seguro ejecutarla varias veces (ON CONFLICT DO NOTHING). Ejecútala en tu base de datos existente:
--   psql -U <usuario> -d <base> -f db/migraciones/002_sitios.sql
INSERT INTO entidades (codigo, nombre, tipo, web) VALUES
  ('airtm',    'Airtm',      'billetera', 'https://www.airtm.com'),
  ('takenos',  'Takenos',    'billetera', 'https://takenos.com'),
  ('eldorado', 'El Dorado',  'exchange',  'https://eldorado.io'),
  ('bitget',   'Bitget P2P', 'exchange',  'https://www.bitget.com')
ON CONFLICT (codigo) DO NOTHING;
