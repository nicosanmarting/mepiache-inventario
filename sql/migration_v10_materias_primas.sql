-- ===========================================================
-- Mepiache Inventario - Migracion v10: Materias primas
-- Ejecutar completo en: Supabase > SQL Editor > New query
-- ===========================================================
--
-- Que hace este script:
--   1) Crea la tabla `materias_primas` (insumos: frutas, chocolates,
--      salsas, secos, envases, etc.) con campos "generales" (visibles
--      para todos) y campos "admin" (proveedor, costo, pedido
--      promedio, notas) que solo se muestran/editan si el usuario es
--      admin (igual criterio cosmetico que el resto del sistema).
--   2) Crea `movimientos_materias_primas` (entrada/salida/ajuste de
--      stock) + indice por materia_prima/fecha.
--   3) Crea el RPC `registrar_movimiento_mp`, analogo a
--      `registrar_movimiento` pero para materias primas (admite
--      cantidades decimales: kg, litros, etc.).
--   4) Carga un catalogo inicial consolidado a partir de las
--      planillas de stock (Helados, Paletas, Gelato Premium). Las
--      cantidades de stock quedan en 0 — se ajustan despues desde la
--      pagina Materias primas (movimiento tipo "ajuste").
--
-- Nota para el futuro (no se implementa en esta migracion):
--   La idea es eventualmente vincular cada producto terminado con
--   las materias primas que usa (una "receta"/formula con cantidades),
--   para poder descontar materia prima automaticamente al registrar
--   produccion y generar alertas de stock bajo de insumos. Cuando se
--   tengan esas formulas, se agregaria una tabla `recetas_producto`
--   (producto_id, materia_prima_id, cantidad_por_unidad) y se
--   actualizaria `registrar_movimiento` (tipo 'produccion') para
--   descontar materia prima ademas de sumar stock de producto.
-- ===========================================================


-- ===========================================================
-- 1) Tabla materias_primas
-- ===========================================================

create table if not exists materias_primas (
  id uuid default gen_random_uuid() primary key,
  codigo text unique,
  nombre text not null,
  categoria text not null,
  unidad_medida text not null default 'unidad',
  stock_actual numeric(12,2) not null default 0,
  stock_minimo numeric(12,2) not null default 0,
  -- Campos "admin" (proveedor / costos / pedido habitual)
  proveedor_nombre text,
  proveedor_contacto text,
  costo_unitario numeric(12,2),
  pedido_promedio numeric(12,2),
  notas text,
  activo boolean not null default true,
  orden integer,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index if not exists idx_materias_primas_categoria on materias_primas (categoria);

alter table materias_primas enable row level security;

create policy "Usuarios autenticados pueden leer/escribir materias_primas"
  on materias_primas for all
  to authenticated
  using (true)
  with check (true);


-- ===========================================================
-- 2) Tabla movimientos_materias_primas
-- ===========================================================

create table if not exists movimientos_materias_primas (
  id uuid default gen_random_uuid() primary key,
  materia_prima_id uuid references materias_primas(id) not null,
  tipo_movimiento text not null check (tipo_movimiento in ('entrada', 'salida', 'ajuste')),
  cantidad numeric(12,2) not null,
  stock_antes numeric(12,2) not null,
  stock_despues numeric(12,2) not null,
  motivo text,
  nota text,
  usuario_id uuid references auth.users(id),
  fecha date not null default current_date,
  created_at timestamp default now()
);

create index if not exists idx_mov_mp_materia_fecha on movimientos_materias_primas (materia_prima_id, fecha desc);

alter table movimientos_materias_primas enable row level security;

create policy "Usuarios autenticados pueden leer/escribir movimientos_materias_primas"
  on movimientos_materias_primas for all
  to authenticated
  using (true)
  with check (true);


-- ===========================================================
-- 3) RPC registrar_movimiento_mp
-- ===========================================================
--
--   p_tipo_movimiento: 'entrada' | 'salida' | 'ajuste'
--   p_cantidad: positivo para 'entrada'/'salida'. Para 'ajuste' puede
--               ser positivo o negativo (se suma directo al stock,
--               igual que 'ajuste_manual' en registrar_movimiento).
--   p_permitir_negativo: si es false (default), 'salida' falla si
--               deja el stock bajo cero.
create or replace function registrar_movimiento_mp(
  p_materia_prima_id uuid,
  p_tipo_movimiento text,
  p_cantidad numeric,
  p_motivo text default null,
  p_nota text default null,
  p_fecha date default current_date,
  p_permitir_negativo boolean default false
) returns table (stock_antes numeric, stock_despues numeric)
language plpgsql
as $$
declare
  v_stock_actual numeric;
  v_delta numeric;
  v_nuevo numeric;
  v_usuario uuid;
begin
  v_usuario := auth.uid();

  select mp.stock_actual into v_stock_actual
  from materias_primas mp
  where mp.id = p_materia_prima_id
  for update;

  if v_stock_actual is null then
    raise exception 'Materia prima % no encontrada', p_materia_prima_id;
  end if;

  case p_tipo_movimiento
    when 'entrada' then v_delta := p_cantidad;
    when 'salida' then v_delta := -p_cantidad;
    when 'ajuste' then v_delta := p_cantidad;
    else raise exception 'tipo_movimiento % no valido para registrar_movimiento_mp', p_tipo_movimiento;
  end case;

  v_nuevo := v_stock_actual + v_delta;

  if v_nuevo < 0 and not p_permitir_negativo and p_tipo_movimiento = 'salida' then
    raise exception 'Stock insuficiente: stock actual %, cantidad solicitada %', v_stock_actual, p_cantidad;
  end if;

  update materias_primas
    set stock_actual = v_nuevo, updated_at = now()
    where id = p_materia_prima_id;

  insert into movimientos_materias_primas
    (materia_prima_id, tipo_movimiento, cantidad, stock_antes, stock_despues, motivo, nota, usuario_id, fecha)
  values
    (p_materia_prima_id, p_tipo_movimiento, p_cantidad, v_stock_actual, v_nuevo, p_motivo, p_nota, v_usuario, p_fecha);

  return query select v_stock_actual, v_nuevo;
end;
$$;


-- ===========================================================
-- 4) Catalogo inicial (consolidado desde planillas de stock)
-- ===========================================================
-- Stock en 0 por defecto: ajustar desde la pagina Materias primas
-- (movimiento tipo "ajuste") una vez migrado.

insert into materias_primas (codigo, nombre, categoria, unidad_medida, stock_minimo, orden) values
  -- Frutas y pulpas
  ('MP-001', 'Piña',                    'Frutas y pulpas', 'kg', 0, 1),
  ('MP-002', 'Maracuyá',                'Frutas y pulpas', 'kg', 0, 2),
  ('MP-003', 'Mango',                   'Frutas y pulpas', 'kg', 0, 3),
  ('MP-004', 'Arándano',                'Frutas y pulpas', 'kg', 0, 4),
  ('MP-005', 'Frutilla',                'Frutas y pulpas', 'kg', 0, 5),
  ('MP-006', 'Frambuesa',               'Frutas y pulpas', 'kg', 0, 6),
  ('MP-007', 'Lúcuma',                  'Frutas y pulpas', 'kg', 0, 7),
  ('MP-008', 'Limón',                   'Frutas y pulpas', 'kg', 0, 8),
  ('MP-009', 'Manzana',                 'Frutas y pulpas', 'kg', 0, 9),

  -- Chocolates y coberturas
  ('MP-010', 'Cacao ecuatoriano',       'Chocolates y coberturas', 'kg', 0, 10),
  ('MP-011', 'Cacao holandés',          'Chocolates y coberturas', 'kg', 0, 11),
  ('MP-012', 'Cacao 2224',              'Chocolates y coberturas', 'kg', 0, 12),
  ('MP-013', 'Chocolate Callebaut 811', 'Chocolates y coberturas', 'kg', 0, 13),
  ('MP-014', 'Cobertura de chocolate',  'Chocolates y coberturas', 'kg', 0, 14),
  ('MP-015', 'Chispas de chocolate',    'Chocolates y coberturas', 'kg', 0, 15),
  ('MP-016', 'Nutella',                 'Chocolates y coberturas', 'kg', 0, 16),

  -- Salsas y manjar
  ('MP-017', 'Salsa manjar',            'Salsas y manjar', 'L', 0, 17),
  ('MP-018', 'Salsa frambuesa',         'Salsas y manjar', 'L', 0, 18),
  ('MP-019', 'Salsa de chocolate',      'Salsas y manjar', 'L', 0, 19),
  ('MP-020', 'Manjar',                  'Salsas y manjar', 'kg', 0, 20),

  -- Insumos secos
  ('MP-021', 'Pasas maceradas',         'Insumos secos', 'kg', 0, 21),
  ('MP-022', 'Pasta de maní',           'Insumos secos', 'kg', 0, 22),
  ('MP-023', 'Nueces',                  'Insumos secos', 'kg', 0, 23),
  ('MP-024', 'Pistacho puro',           'Insumos secos', 'kg', 0, 24),
  ('MP-025', 'Galleta Oreo',            'Insumos secos', 'kg', 0, 25),
  ('MP-026', 'Galleta de alfajor',      'Insumos secos', 'kg', 0, 26),
  ('MP-027', 'Quella',                  'Insumos secos', 'kg', 0, 27),
  ('MP-028', 'Maltitol',                'Insumos secos', 'kg', 0, 28),
  ('MP-029', 'Polidextrosa',            'Insumos secos', 'kg', 0, 29),
  ('MP-030', 'Nescafé',                 'Insumos secos', 'kg', 0, 30),
  ('MP-031', 'Avellana regina',         'Insumos secos', 'kg', 0, 31),

  -- Pregel (gelato premium)
  ('MP-032', 'Pregel Vainilla Cero',     'Pregel (gelato premium)', 'kg', 0, 32),
  ('MP-033', 'Pregel Vainilla Tahitiana','Pregel (gelato premium)', 'kg', 0, 33),
  ('MP-034', 'Pregel Vainilla Bourbon',  'Pregel (gelato premium)', 'kg', 0, 34),
  ('MP-035', 'Pregel Yoggi',             'Pregel (gelato premium)', 'kg', 0, 35),
  ('MP-036', 'Pregel Mascarpone',        'Pregel (gelato premium)', 'kg', 0, 36),
  ('MP-037', 'Pregel Tiramisú',          'Pregel (gelato premium)', 'kg', 0, 37),

  -- Lácteos y frescos
  ('MP-038', 'Crema',                   'Lácteos y frescos', 'L', 0, 38),
  ('MP-039', 'Yogurt',                  'Lácteos y frescos', 'L', 0, 39),
  ('MP-040', 'Agua',                    'Lácteos y frescos', 'L', 0, 40),

  -- Hierbas y aromáticas
  ('MP-041', 'Albahaca',                'Hierbas y aromáticas', 'kg', 0, 41),
  ('MP-042', 'Menta',                   'Hierbas y aromáticas', 'kg', 0, 42),
  ('MP-043', 'Jengibre',                'Hierbas y aromáticas', 'kg', 0, 43),

  -- Envases y empaque
  ('MP-044', 'Botes 10 L',              'Envases y empaque', 'unidad', 0, 44),
  ('MP-045', 'Bachas 5 L',              'Envases y empaque', 'unidad', 0, 45),
  ('MP-046', 'Cajas 4x5 bachas',        'Envases y empaque', 'unidad', 0, 46),
  ('MP-047', 'Cajas paletas',           'Envases y empaque', 'unidad', 0, 47),
  ('MP-048', 'Etiquetas',               'Envases y empaque', 'unidad', 0, 48),
  ('MP-049', 'Palos Mepiache',          'Envases y empaque', 'unidad', 0, 49),
  ('MP-050', 'Palos Mis Paletas',       'Envases y empaque', 'unidad', 0, 50),
  ('MP-051', 'Empaque paletas',         'Envases y empaque', 'unidad', 0, 51)
on conflict (codigo) do nothing;
