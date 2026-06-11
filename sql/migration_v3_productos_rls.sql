-- ===========================================================
-- Mepiache Inventario - Migración v3
-- Permisos faltantes sobre la tabla productos
-- ===========================================================
-- La tabla productos solo tenía una política de SELECT para
-- usuarios autenticados. Esto bloquea (silenciosamente, vía RLS):
--   - Las funciones registrar_movimiento / finalizar_conteo, que
--     actualizan productos.stock_actual y updated_at.
--   - La nueva pantalla de Configuración/productos (admin), que
--     permite editar y crear productos del catálogo.
--
-- Misma política de confianza que el resto del sistema:
-- "usuarios autenticados pueden leer/escribir" (2 usuarios internos).
-- Ejecutar en el SQL Editor de Supabase.
-- ===========================================================

create policy "Usuarios autenticados pueden actualizar productos"
  on productos for update
  to authenticated
  using (true)
  with check (true);

create policy "Usuarios autenticados pueden insertar productos"
  on productos for insert
  to authenticated
  with check (true);
