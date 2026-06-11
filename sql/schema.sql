-- ===========================================================
-- Mepiache Inventario - Esquema Supabase
-- Ejecutar completo en: Supabase > SQL Editor > New query
-- ===========================================================

-- 1) Tablas
create table if not exists productos (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  sabor text not null,
  formato text not null,  -- '5L' o '10L'
  activo boolean default true,
  created_at timestamp default now()
);

create table if not exists batches (
  id uuid default gen_random_uuid() primary key,
  producto_id uuid references productos(id),
  cantidad integer not null,
  fecha date not null,
  usuario_id uuid references auth.users(id),
  notas text,
  created_at timestamp default now()
);

create table if not exists ventas (
  id uuid default gen_random_uuid() primary key,
  producto_id uuid references productos(id),
  cantidad integer not null,
  fecha date not null,
  canal text default 'presencial',
  usuario_id uuid references auth.users(id),
  notas text,
  created_at timestamp default now()
);

-- 2) Seguridad: habilitar Row Level Security
-- (Supabase la activa por defecto en proyectos nuevos, pero por si acaso)
alter table productos enable row level security;
alter table batches enable row level security;
alter table ventas enable row level security;

-- Política simple: cualquier usuario autenticado puede leer y escribir.
-- Suficiente para 2 usuarios internos (Nico + empleado).
-- Se puede refinar más adelante (ej: solo admin borra productos).
create policy "Usuarios autenticados pueden leer productos"
  on productos for select
  to authenticated
  using (true);

create policy "Usuarios autenticados pueden leer/escribir batches"
  on batches for all
  to authenticated
  using (true)
  with check (true);

create policy "Usuarios autenticados pueden leer/escribir ventas"
  on ventas for all
  to authenticated
  using (true)
  with check (true);

-- 3) Datos iniciales: catálogo de sabores reales (productos.json del sitio web)

-- Helados 5 Litros
insert into productos (nombre, sabor, formato) values
  ('Helado 5L', 'Arroz con Leche',   '5L'),
  ('Helado 5L', 'Banana Split',      '5L'),
  ('Helado 5L', 'Café Capuchino',    '5L'),
  ('Helado 5L', 'Chirimoya Alegre',  '5L'),
  ('Helado 5L', 'Chocolate Clásico', '5L'),
  ('Helado 5L', 'Frambuesa',         '5L'),
  ('Helado 5L', 'Frutos del Bosque', '5L'),
  ('Helado 5L', 'Lúcuma Manjar',     '5L'),
  ('Helado 5L', 'Piña al Agua',      '5L'),
  ('Helado 5L', 'Pistacho',          '5L'),
  ('Helado 5L', 'Vainilla',          '5L');

-- Helados 10 Litros (según temporada y stock)
insert into productos (nombre, sabor, formato) values
  ('Helado 10L', 'Chocolate',        '10L'),
  ('Helado 10L', 'Frutilla',         '10L'),
  ('Helado 10L', 'Vainilla',         '10L'),
  ('Helado 10L', 'Lúcuma',           '10L'),
  ('Helado 10L', 'Frambuesa',        '10L'),
  ('Helado 10L', 'Chirimoya Alegre', '10L'),
  ('Helado 10L', 'Manjar',           '10L');

-- NOTA: el contexto original menciona "12 sabores" para 5L pero solo
-- se conocen 11 nombres. Agregar el sabor faltante con un INSERT extra
-- cuando se confirme cuál es.
