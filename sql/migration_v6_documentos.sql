-- =====================================================
-- Mepiache Inventario - Migration v6: Documentos de gestión
-- =====================================================
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================

-- 1. Tabla de documentos
CREATE TABLE IF NOT EXISTS documentos_gestion (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo           TEXT        NOT NULL,
  categoria        TEXT        NOT NULL,   -- ej: 'Proveedor', 'Equipo prestado', etc.
  descripcion      TEXT,
  contraparte      TEXT,                   -- empresa o persona involucrada
  fecha_documento  DATE,
  fecha_vencimiento DATE,                  -- para alertar contratos próximos a vencer
  archivo_path     TEXT,                   -- path en bucket 'documentos'
  archivo_nombre   TEXT,
  vigente          BOOLEAN     DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 2. Row Level Security
ALTER TABLE documentos_gestion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_select"
  ON documentos_gestion FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "documentos_insert"
  ON documentos_gestion FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "documentos_update"
  ON documentos_gestion FOR UPDATE
  TO authenticated
  USING (true);

-- 3. Bucket de Storage para archivos de documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documentos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "documentos_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY "documentos_update_obj"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY "documentos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documentos');
