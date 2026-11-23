-- Migración 006: artículos para usuarios premium. Segura de ejecutar varias veces.
-- En pgAdmin: Query Tool → pegar → F5.
-- Cualquiera ve el título y el resumen; el cuerpo completo solo lo leen usuarios premium (y el administrador).
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
