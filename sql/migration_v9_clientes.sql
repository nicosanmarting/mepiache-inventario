-- ===========================================================
-- Mepiache Inventario - Migracion v9: Clientes frecuentes
-- Ejecutar completo en: Supabase > SQL Editor > New query
-- ===========================================================
--
-- Que hace este script:
--   1) Crea la tabla `clientes` (lista de clientes frecuentes,
--      visible y editable por cualquier usuario autenticado,
--      no solo admin), gestionada desde clientes.html
--   2) Agrega la columna `cliente_id` a movimientos_inventario
--   3) Actualiza registrar_movimiento para recibir y guardar
--      el cliente (opcional, pensado para venta_salida)
-- ===========================================================


-- ===========================================================
-- 1) Tabla clientes
-- ===========================================================

create table if not exists clientes (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  contacto_telefono text,
  contacto_email text,
  activo boolean not null default true,
  orden integer,
  created_at timestamp default now()
);

alter table clientes enable row level security;

create policy "Usuarios autenticados pueden leer/escribir clientes"
  on clientes for all
  to authenticated
  using (true)
  with check (true);


-- ===========================================================
-- 2) Columna cliente_id en movimientos_inventario
-- ===========================================================

alter table movimientos_inventario
  add column if not exists cliente_id uuid references clientes(id);


-- ===========================================================
-- 3) Actualizar registrar_movimiento para recibir cliente_id
-- ===========================================================

create or replace function registrar_movimiento(
  p_producto_id uuid,
  p_tipo_movimiento text,
  p_cantidad integer,
  p_motivo text default null,
  p_nota text default null,
  p_fecha date default current_date,
  p_permitir_negativo boolean default false,
  p_cliente_id uuid default null
) returns table (stock_antes integer, stock_despues integer)
language plpgsql
as $$
declare
  v_stock_actual integer;
  v_delta integer;
  v_nuevo integer;
  v_usuario uuid;
begin
  v_usuario := auth.uid();

  select p.stock_actual into v_stock_actual
  from productos p
  where p.id = p_producto_id
  for update;

  if v_stock_actual is null then
    raise exception 'Producto % no encontrado', p_producto_id;
  end if;

  case p_tipo_movimiento
    when 'produccion' then v_delta := p_cantidad;
    when 'venta_salida' then v_delta := -p_cantidad;
    when 'merma' then v_delta := -p_cantidad;
    when 'ajuste_manual' then v_delta := p_cantidad;
    else raise exception 'tipo_movimiento % no valido para registrar_movimiento', p_tipo_movimiento;
  end case;

  v_nuevo := v_stock_actual + v_delta;

  if v_nuevo < 0 and not p_permitir_negativo and p_tipo_movimiento in ('venta_salida', 'merma') then
    raise exception 'Stock insuficiente: stock actual %, cantidad solicitada %', v_stock_actual, p_cantidad;
  end if;

  update productos
    set stock_actual = v_nuevo, updated_at = now()
    where id = p_producto_id;

  insert into movimientos_inventario
    (producto_id, tipo_movimiento, cantidad, stock_antes, stock_despues, motivo, nota, usuario_id, fecha, cliente_id)
  values
    (p_producto_id, p_tipo_movimiento, p_cantidad, v_stock_actual, v_nuevo, p_motivo, p_nota, v_usuario, p_fecha, p_cliente_id);

  return query select v_stock_actual, v_nuevo;
end;
$$;
