-- =====================================================
-- Mepiache Inventario - Migration v8: Contrato en Conservadoras
-- =====================================================
-- Ejecutar en el SQL Editor de Supabase.
--
-- Agrega columnas para adjuntar un documento (ej: contrato
-- de comodato) a cada conservadora, y crea el bucket de
-- Storage correspondiente.
-- =====================================================

-- 1. Columnas nuevas en conservadoras
ALTER TABLE conservadoras
  ADD COLUMN IF NOT EXISTS contrato_path TEXT,     -- path dentro del bucket 'conservadoras'
  ADD COLUMN IF NOT EXISTS contrato_nombre TEXT;   -- nombre original del archivo

-- 2. Bucket de Storage para contratos de conservadoras
INSERT INTO storage.buckets (id, name, public)
VALUES ('conservadoras', 'conservadoras', false)
ON CONFLICT (id) DO NOTHING;

-- Cualquier usuario autenticado puede subir, leer, actualizar y eliminar
-- (el control de admin se hace en el frontend, igual que trabajadores/documentos)
CREATE POLICY "conservadoras_contrato_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'conservadoras');

CREATE POLICY "conservadoras_contrato_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'conservadoras');

CREATE POLICY "conservadoras_contrato_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'conservadoras');

CREATE POLICY "conservadoras_contrato_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'conservadoras');
