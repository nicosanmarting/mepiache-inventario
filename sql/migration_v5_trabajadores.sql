-- =====================================================
-- Mepiache Inventario - Migration v5: Trabajadores
-- =====================================================
-- Ejecutar en el SQL Editor de Supabase.
--
-- Crea la tabla de trabajadores y configura el bucket
-- de Supabase Storage para almacenar contratos.
-- =====================================================

-- 1. Tabla de trabajadores
CREATE TABLE IF NOT EXISTS trabajadores (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        TEXT        NOT NULL,
  rut           TEXT,
  cargo         TEXT,
  fecha_ingreso DATE,
  inoperancia   TEXT,       -- notas de ausencias, licencias, días no trabajados
  contrato_path TEXT,       -- path dentro del bucket 'contratos'
  contrato_nombre TEXT,     -- nombre original del archivo
  activo        BOOLEAN     DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Row Level Security
ALTER TABLE trabajadores ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer
CREATE POLICY "trabajadores_select"
  ON trabajadores FOR SELECT
  TO authenticated
  USING (true);

-- Cualquier usuario autenticado puede insertar y actualizar
-- (el control de admin se hace en el frontend)
CREATE POLICY "trabajadores_insert"
  ON trabajadores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "trabajadores_update"
  ON trabajadores FOR UPDATE
  TO authenticated
  USING (true);

-- 3. Bucket de Storage para contratos
-- Ejecutar esto SOLO si no existe el bucket aún.
-- También se puede crear desde el panel de Supabase:
--   Storage → New bucket → "contratos" (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: usuarios autenticados pueden subir y leer contratos
CREATE POLICY "contratos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contratos');

CREATE POLICY "contratos_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'contratos');

CREATE POLICY "contratos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'contratos');

CREATE POLICY "contratos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contratos');
