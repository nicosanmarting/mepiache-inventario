-- ===========================================================
-- Mepiache Inventario - Migracion v4: Encargados de conteo
-- Ejecutar completo en: Supabase > SQL Editor > New query
-- Requisito previo: sql/migration_v3_productos_rls.sql ya ejecutado.
--
-- Que hace este script:
--   1) Crea la tabla `encargados` (lista configurable de nombres
--      de personas que pueden quedar a cargo de un conteo),
--      editable desde configuracion.html
--   2) Agrega la columna `encargado` a `conteos`
--   3) Actualiza la funcion crear_conteo para recibir y guardar
--      el encargado
--   4) Carga un par de encargados de ejemplo (ajustar/agregar
--      desde Configuracion > Encargados)
-- ===========================================================


-- ===========================================================
-- 1) Tabla encargados
-- ===========================================================

create table if not exists encargados (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  activo boolean not null default true,
  orden integer,
  created_at timestamp default now()
);

alter table encargados enable row level security;

create policy "Usuarios autenticados pueden leer/escribir encargados"
  on encargados for all
  to authenticated
  using (true)
  with check (true);

insert into encargados (nombre, orden)
values
  ('Alex', 1),
  ('Diego', 2)
on conflict do nothing;


-- ===========================================================
-- 2) Columna encargado en conteos
-- ===========================================================

alter table conteos add column if not exists encargado text;


-- ===========================================================
-- 3) Actualizar crear_conteo para recibir el encargado
-- ===========================================================

create or replace function crear_conteo(
  p_categoria_formato text,
  p_observacion text default null,
  p_encargado text default null
) returns uuid
language plpgsql
as $$
declare
  v_conteo_id uuid;
begin
  insert into conteos (categoria_formato, usuario_id, estado, observacion, encargado)
  values (p_categoria_formato, auth.uid(), 'borrador', p_observacion, p_encargado)
  returning id into v_conteo_id;

  insert into conteo_detalle (conteo_id, producto_id, stock_sistema)
  select v_conteo_id, p.id, p.stock_actual
  from productos p
  where p.categoria_formato = p_categoria_formato and p.activo = true
  order by p.orden;

  return v_conteo_id;
end;
$$;
