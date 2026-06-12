-- =====================================================
-- Mepiache Inventario - Migration v12: Mantención de equipos
-- =====================================================
-- Ejecutar en el SQL Editor de Supabase.
--
-- Crea:
--   1) Tabla `equipos`: catálogo de máquinas/equipos de la
--      fábrica (nombre, descripción, frecuencia de mantención
--      en días).
--   2) Tabla `mantenciones_equipos`: historial de mantenciones
--      realizadas por equipo (fecha, descripción, archivo
--      adjunto opcional).
--   3) Bucket de Storage `equipos` para adjuntar manuales,
--      fichas técnicas o comprobantes de mantención (PDF, etc).
--
-- La "próxima mantención" y el estado (vencido/próximo/ok) se
-- calculan en el frontend a partir de frecuencia_dias y la
-- última fecha registrada en mantenciones_equipos — no se
-- guardan como columnas para evitar datos desincronizados.
-- =====================================================

-- 1. Tabla de equipos/máquinas
CREATE TABLE IF NOT EXISTS equipos (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre          TEXT        NOT NULL,
  descripcion     TEXT,
  frecuencia_dias INTEGER,    -- cada cuántos días corresponde hacer mantención (NULL = sin frecuencia definida)
  activo          BOOLEAN     DEFAULT true,
  orden           INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;

-- Igual que trabajadores/conservadoras: control de admin es cosmético
-- en el frontend (ADMIN_EMAILS en js/nav.js), RLS abierto a authenticated.
CREATE POLICY "equipos_select" ON equipos FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipos_insert" ON equipos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "equipos_update" ON equipos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "equipos_delete" ON equipos FOR DELETE TO authenticated USING (true);


-- 2. Tabla de mantenciones (historial por equipo)
CREATE TABLE IF NOT EXISTS mantenciones_equipos (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  equipo_id      UUID        NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  fecha          DATE        NOT NULL DEFAULT current_date,
  descripcion    TEXT,
  archivo_path   TEXT,       -- path dentro del bucket 'equipos'
  archivo_nombre TEXT,       -- nombre original del archivo
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mantenciones_equipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mantenciones_equipos_select" ON mantenciones_equipos FOR SELECT TO authenticated USING (true);
CREATE POLICY "mantenciones_equipos_insert" ON mantenciones_equipos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mantenciones_equipos_update" ON mantenciones_equipos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "mantenciones_equipos_delete" ON mantenciones_equipos FOR DELETE TO authenticated USING (true);


-- 3. Bucket de Storage para adjuntos (manuales, fichas técnicas, comprobantes)
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipos', 'equipos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "equipos_archivos_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'equipos');
CREATE POLICY "equipos_archivos_read"   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'equipos');
CREATE POLICY "equipos_archivos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'equipos');
CREATE POLICY "equipos_archivos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'equipos');
