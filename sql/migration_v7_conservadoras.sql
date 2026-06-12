-- =====================================================
-- Mepiache Inventario - Migration v7: Conservadoras
-- =====================================================
-- Ejecutar en el SQL Editor de Supabase.
--
-- Crea la tabla de conservadoras (equipos/refrigeradores
-- entregados a clientes) para llevar inventario de
-- ubicación, contacto y estado de cada unidad.
-- =====================================================

-- 1. Tabla de conservadoras
CREATE TABLE IF NOT EXISTS conservadoras (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo            TEXT,       -- código o número de serie del equipo
  modelo            TEXT,
  cliente_nombre    TEXT        NOT NULL,
  contacto_telefono TEXT,
  contacto_email    TEXT,
  ubicacion         TEXT,
  fecha_entrega     DATE,
  estado            TEXT        NOT NULL DEFAULT 'en_uso'
                      CHECK (estado IN ('en_uso', 'mantencion', 'devuelta')),
  notas             TEXT,
  activo            BOOLEAN     DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- 2. Row Level Security
ALTER TABLE conservadoras ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer
CREATE POLICY "conservadoras_select"
  ON conservadoras FOR SELECT
  TO authenticated
  USING (true);

-- Cualquier usuario autenticado puede insertar y actualizar
-- (el control de admin se hace en el frontend, igual que trabajadores/documentos)
CREATE POLICY "conservadoras_insert"
  ON conservadoras FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "conservadoras_update"
  ON conservadoras FOR UPDATE
  TO authenticated
  USING (true);
