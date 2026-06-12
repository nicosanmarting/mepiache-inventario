-- =====================================================
-- Mepiache Inventario - Migration v13: Precio de venta
-- =====================================================
-- Ejecutar en el SQL Editor de Supabase.
--
-- Agrega la columna `precio_venta` a `productos`: precio de
-- venta unitario actual (CLP), editable solo desde
-- Configuración (admin). Se usa para calcular ingresos en
-- Métricas cruzando precio_venta x cantidad de movimientos
-- tipo 'venta_salida'. No se guarda historial de precios:
-- los ingresos se calculan siempre con el precio actual.
-- =====================================================

alter table productos
  add column if not exists precio_venta numeric not null default 0;
