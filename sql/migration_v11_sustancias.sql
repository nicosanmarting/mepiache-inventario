-- ===========================================================
-- Mepiache Inventario - Migracion v11: Sustancias
-- Ejecutar completo en: Supabase > SQL Editor > New query
-- ===========================================================
--
-- Que hace este script:
--   1) Agrega 'Sustancias' a las categorias/formato validas
--      (constraint productos_categoria_formato_check). Postgres no
--      permite agregar un valor a un check existente, asi que se
--      elimina y se vuelve a crear con la lista completa.
--   2) Carga el catalogo inicial de "Sustancias" (dulce chileno):
--      8 formatos, codigos 301/303/306/304/311/313/316/314, stock
--      en 0 — se ajusta despues desde un conteo real.
--
--      "Contenido" para Sustancias = cajas que contienen N paquetes
--      de M unidades cada uno (ej: codigo 301 "60x10" = caja con 60
--      paquetes de 10 unidades). unidad_conteo = 'cajas'.
-- ===========================================================


-- ===========================================================
-- 1) Agregar 'Sustancias' al check de categoria_formato
-- ===========================================================

alter table productos drop constraint if exists productos_categoria_formato_check;

alter table productos add constraint productos_categoria_formato_check
  check (categoria_formato is null or categoria_formato in (
    'Bote 10 L', 'Bacha 5 L', 'Paletas', 'Mis Paletas',
    'Gelato Premium Bachas', 'Gelato Premium Caja 6x750ml',
    'Sustancias'
  ));


-- ===========================================================
-- 2) Catalogo inicial de Sustancias
-- ===========================================================

-- No hay constraint unique en productos.codigo, asi que se usa
-- "insert ... select ... where not exists" en vez de on conflict
-- (permite re-ejecutar el script sin duplicar filas).
insert into productos
  (nombre, sabor, categoria_formato, linea, codigo, unidad_conteo, contenido, unidad_contenido, stock_actual, stock_minimo, orden, activo)
select v.nombre, v.sabor, v.categoria_formato, v.linea, v.codigo, v.unidad_conteo, v.contenido, v.unidad_contenido, v.stock_actual, v.stock_minimo, v.orden, v.activo
from (values
  ('Sustancia 60x10', 'Sustancia 60x10', 'Sustancias', 'Sustancias', '301', 'cajas', 60::numeric, 'paquetes de 10 un', 0, 0, 1, true),
  ('Sustancia 25x20', 'Sustancia 25x20', 'Sustancias', 'Sustancias', '303', 'cajas', 25::numeric, 'paquetes de 20 un', 0, 0, 2, true),
  ('Sustancia 30x10', 'Sustancia 30x10', 'Sustancias', 'Sustancias', '311', 'cajas', 30::numeric, 'paquetes de 10 un', 0, 0, 3, true),
  ('Sustancia 8x20',  'Sustancia 8x20',  'Sustancias', 'Sustancias', '313', 'cajas', 8::numeric,  'paquetes de 20 un', 0, 0, 4, true),
  ('Helado 50x10',    'Helado 50x10',    'Sustancias', 'Sustancias', '306', 'cajas', 50::numeric, 'paquetes de 10 un', 0, 0, 5, true),
  ('Helado 15x10',    'Helado 15x10',    'Sustancias', 'Sustancias', '316', 'cajas', 15::numeric, 'paquetes de 10 un', 0, 0, 6, true),
  ('Glotón 20x10',    'Glotón 20x10',    'Sustancias', 'Sustancias', '304', 'cajas', 20::numeric, 'paquetes de 10 un', 0, 0, 7, true),
  ('Glotón 70x10',    'Glotón 70x10',    'Sustancias', 'Sustancias', '314', 'cajas', 70::numeric, 'paquetes de 10 un', 0, 0, 8, true)
) as v(nombre, sabor, categoria_formato, linea, codigo, unidad_conteo, contenido, unidad_contenido, stock_actual, stock_minimo, orden, activo)
where not exists (select 1 from productos p where p.codigo = v.codigo);
