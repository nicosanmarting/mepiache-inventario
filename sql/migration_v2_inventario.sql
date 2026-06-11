-- ===========================================================
-- Mepiache Inventario - Migracion v2: Inventario operativo
-- Ejecutar completo en: Supabase > SQL Editor > New query
-- Requisito previo: sql/schema.sql ya ejecutado.
--
-- Que hace este script:
--   1) Amplia la tabla productos con los campos del nuevo modelo
--   2) Da de baja (activo=false) el catalogo anterior (18 productos)
--   3) Carga el catalogo real (115 productos: Helados, Paletas,
--      Mis Paletas, Gelato Premium)
--   4) Crea movimientos_inventario, conteos y conteo_detalle
--   5) Crea las funciones registrar_movimiento, crear_conteo y
--      finalizar_conteo
--   6) Migra el historial de batches/ventas a movimientos_inventario
--      y recalcula stock_actual de los productos antiguos
--
-- Notas / supuestos (ver Catalogo_Mepiache_propuesto.xlsx):
--   - stock_actual de los 115 productos nuevos parte en 0. Se
--     recomienda hacer un "Nuevo conteo" por categoria apenas se
--     publique, para cargar el stock real.
--   - El codigo 102/202 ('Mango Maracuya / Salsa Frambuesa') se dejo
--     como UN solo sabor. Si en realidad son sabores distintos, se
--     pueden separar despues editando productos (no rompe nada).
--   - Los 18 sabores de Gelato Premium se cargaron en AMBAS
--     categorias (Bachas y Caja 6x750ml). Si algun sabor no existe
--     en una de las dos presentaciones, basta con poner activo=false
--     en esa fila desde Configuracion/productos.
--   - stock_minimo: 5 (Helados), 20 (Paletas/Mis Paletas), 3 (Gelato
--     Premium). Editable por sabor mas adelante.
-- ===========================================================


-- ===========================================================
-- 1) Ampliar tabla productos
-- ===========================================================

alter table productos add column if not exists codigo text;
alter table productos add column if not exists categoria_formato text;
alter table productos add column if not exists linea text;
alter table productos add column if not exists unidad_conteo text default 'unidades';
alter table productos add column if not exists contenido numeric;
alter table productos add column if not exists unidad_contenido text;
alter table productos add column if not exists stock_actual integer not null default 0;
alter table productos add column if not exists stock_minimo integer not null default 0;
alter table productos add column if not exists orden integer;
alter table productos add column if not exists updated_at timestamp default now();

-- 'formato' era obligatorio en el modelo viejo; el catalogo nuevo usa
-- categoria_formato en su lugar, asi que se vuelve opcional.
alter table productos alter column formato drop not null;

-- Restringe categoria_formato a las 6 categorias del nuevo modelo
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'productos_categoria_formato_check'
  ) then
    alter table productos add constraint productos_categoria_formato_check
      check (categoria_formato is null or categoria_formato in (
        'Bote 10 L', 'Bacha 5 L', 'Paletas', 'Mis Paletas',
        'Gelato Premium Bachas', 'Gelato Premium Caja 6x750ml'
      ));
  end if;
end $$;


-- ===========================================================
-- 2) Dar de baja el catalogo anterior (18 productos sin codigo)
-- ===========================================================

update productos set activo = false where codigo is null;


-- ===========================================================
-- 3) Catalogo nuevo (115 productos)
-- ===========================================================

insert into productos
  (nombre, sabor, categoria_formato, linea, codigo, unidad_conteo, contenido, unidad_contenido, stock_actual, stock_minimo, orden, activo)
values
  ('Frutos del Bosque', 'Frutos del Bosque', 'Bote 10 L', 'Helados', '101', 'unidades', 10, 'L', 0, 5, 1, true),
  ('Mango Maracuyá / Salsa Frambuesa', 'Mango Maracuyá / Salsa Frambuesa', 'Bote 10 L', 'Helados', '102', 'unidades', 10, 'L', 0, 5, 2, true),
  ('Frutilla', 'Frutilla', 'Bote 10 L', 'Helados', '104', 'unidades', 10, 'L', 0, 5, 3, true),
  ('Vainilla', 'Vainilla', 'Bote 10 L', 'Helados', '105', 'unidades', 10, 'L', 0, 5, 4, true),
  ('Chocolate', 'Chocolate', 'Bote 10 L', 'Helados', '106', 'unidades', 10, 'L', 0, 5, 5, true),
  ('Coco Nut', 'Coco Nut', 'Bote 10 L', 'Helados', '108', 'unidades', 10, 'L', 0, 5, 6, true),
  ('Lúcuma Manjar', 'Lúcuma Manjar', 'Bote 10 L', 'Helados', '109', 'unidades', 10, 'L', 0, 5, 7, true),
  ('Chirimoya Alegre', 'Chirimoya Alegre', 'Bote 10 L', 'Helados', '110', 'unidades', 10, 'L', 0, 5, 8, true),
  ('Mora Crema', 'Mora Crema', 'Bote 10 L', 'Helados', '111', 'unidades', 10, 'L', 0, 5, 9, true),
  ('Chocolate Suizo', 'Chocolate Suizo', 'Bote 10 L', 'Helados', '112', 'unidades', 10, 'L', 0, 5, 10, true),
  ('Pistacho', 'Pistacho', 'Bote 10 L', 'Helados', '113', 'unidades', 10, 'L', 0, 5, 11, true),
  ('Tres Leches', 'Tres Leches', 'Bote 10 L', 'Helados', '114', 'unidades', 10, 'L', 0, 5, 12, true),
  ('Manzana Limón', 'Manzana Limón', 'Bote 10 L', 'Helados', '115', 'unidades', 10, 'L', 0, 5, 13, true),
  ('Pasas al Ron', 'Pasas al Ron', 'Bote 10 L', 'Helados', '117', 'unidades', 10, 'L', 0, 5, 14, true),
  ('Banana Split', 'Banana Split', 'Bote 10 L', 'Helados', '118', 'unidades', 10, 'L', 0, 5, 15, true),
  ('Menta Chip', 'Menta Chip', 'Bote 10 L', 'Helados', '120', 'unidades', 10, 'L', 0, 5, 16, true),
  ('Café Capuchino', 'Café Capuchino', 'Bote 10 L', 'Helados', '121', 'unidades', 10, 'L', 0, 5, 17, true),
  ('Piña Silvestre', 'Piña Silvestre', 'Bote 10 L', 'Helados', '122', 'unidades', 10, 'L', 0, 5, 18, true),
  ('Piña en Agua (Terremoto)', 'Piña en Agua (Terremoto)', 'Bote 10 L', 'Helados', '125', 'unidades', 10, 'L', 0, 5, 19, true),
  ('Pitufo', 'Pitufo', 'Bote 10 L', 'Helados', '126', 'unidades', 10, 'L', 0, 5, 20, true),
  ('Frambuesa', 'Frambuesa', 'Bote 10 L', 'Helados', '132', 'unidades', 10, 'L', 0, 5, 21, true),
  ('Arroz con Leche', 'Arroz con Leche', 'Bote 10 L', 'Helados', '129', 'unidades', 10, 'L', 0, 5, 22, true),
  ('Manjarate', 'Manjarate', 'Bote 10 L', 'Helados', '130', 'unidades', 10, 'L', 0, 5, 23, true),
  ('Sandía', 'Sandía', 'Bote 10 L', 'Helados', '133', 'unidades', 10, 'L', 0, 5, 24, true),
  ('Frutos del Bosque', 'Frutos del Bosque', 'Bacha 5 L', 'Helados', '201', 'unidades', 5, 'L', 0, 5, 1, true),
  ('Mango Maracuyá / Salsa Frambuesa', 'Mango Maracuyá / Salsa Frambuesa', 'Bacha 5 L', 'Helados', '202', 'unidades', 5, 'L', 0, 5, 2, true),
  ('Frutilla', 'Frutilla', 'Bacha 5 L', 'Helados', '204', 'unidades', 5, 'L', 0, 5, 3, true),
  ('Vainilla', 'Vainilla', 'Bacha 5 L', 'Helados', '205', 'unidades', 5, 'L', 0, 5, 4, true),
  ('Chocolate', 'Chocolate', 'Bacha 5 L', 'Helados', '206', 'unidades', 5, 'L', 0, 5, 5, true),
  ('Coco Nut', 'Coco Nut', 'Bacha 5 L', 'Helados', '208', 'unidades', 5, 'L', 0, 5, 6, true),
  ('Lúcuma Manjar', 'Lúcuma Manjar', 'Bacha 5 L', 'Helados', '209', 'unidades', 5, 'L', 0, 5, 7, true),
  ('Chirimoya Alegre', 'Chirimoya Alegre', 'Bacha 5 L', 'Helados', '210', 'unidades', 5, 'L', 0, 5, 8, true),
  ('Mora Crema', 'Mora Crema', 'Bacha 5 L', 'Helados', '211', 'unidades', 5, 'L', 0, 5, 9, true),
  ('Chocolate Suizo', 'Chocolate Suizo', 'Bacha 5 L', 'Helados', '212', 'unidades', 5, 'L', 0, 5, 10, true),
  ('Pistacho', 'Pistacho', 'Bacha 5 L', 'Helados', '213', 'unidades', 5, 'L', 0, 5, 11, true),
  ('Tres Leches', 'Tres Leches', 'Bacha 5 L', 'Helados', '214', 'unidades', 5, 'L', 0, 5, 12, true),
  ('Manzana Limón', 'Manzana Limón', 'Bacha 5 L', 'Helados', '215', 'unidades', 5, 'L', 0, 5, 13, true),
  ('Pasas al Ron', 'Pasas al Ron', 'Bacha 5 L', 'Helados', '217', 'unidades', 5, 'L', 0, 5, 14, true),
  ('Banana Split', 'Banana Split', 'Bacha 5 L', 'Helados', '218', 'unidades', 5, 'L', 0, 5, 15, true),
  ('Menta Chip', 'Menta Chip', 'Bacha 5 L', 'Helados', '220', 'unidades', 5, 'L', 0, 5, 16, true),
  ('Café Capuchino', 'Café Capuchino', 'Bacha 5 L', 'Helados', '221', 'unidades', 5, 'L', 0, 5, 17, true),
  ('Piña Silvestre', 'Piña Silvestre', 'Bacha 5 L', 'Helados', '222', 'unidades', 5, 'L', 0, 5, 18, true),
  ('Piña en Agua (Terremoto)', 'Piña en Agua (Terremoto)', 'Bacha 5 L', 'Helados', '225', 'unidades', 5, 'L', 0, 5, 19, true),
  ('Pitufo', 'Pitufo', 'Bacha 5 L', 'Helados', '226', 'unidades', 5, 'L', 0, 5, 20, true),
  ('Frambuesa', 'Frambuesa', 'Bacha 5 L', 'Helados', '232', 'unidades', 5, 'L', 0, 5, 21, true),
  ('Arroz con Leche', 'Arroz con Leche', 'Bacha 5 L', 'Helados', '229', 'unidades', 5, 'L', 0, 5, 22, true),
  ('Manjarate', 'Manjarate', 'Bacha 5 L', 'Helados', '230', 'unidades', 5, 'L', 0, 5, 23, true),
  ('Sandía', 'Sandía', 'Bacha 5 L', 'Helados', '233', 'unidades', 5, 'L', 0, 5, 24, true),
  ('Mango Maracuyá', 'Mango Maracuyá', 'Paletas', 'Paletas', '451', 'unidades', 1, 'paleta', 0, 20, 1, true),
  ('Frambuesa del Huerto', 'Frambuesa del Huerto', 'Paletas', 'Paletas', '454', 'unidades', 1, 'paleta', 0, 20, 2, true),
  ('Limón Menta Jengibre', 'Limón Menta Jengibre', 'Paletas', 'Paletas', '455', 'unidades', 1, 'paleta', 0, 20, 3, true),
  ('Piña Albahaca', 'Piña Albahaca', 'Paletas', 'Paletas', '456', 'unidades', 1, 'paleta', 0, 20, 4, true),
  ('Manjar Nuez', 'Manjar Nuez', 'Paletas', 'Paletas', '457', 'unidades', 1, 'paleta', 0, 20, 5, true),
  ('Chocolate Nutella', 'Chocolate Nutella', 'Paletas', 'Paletas', '458', 'unidades', 1, 'paleta', 0, 20, 6, true),
  ('Sandía', 'Sandía', 'Paletas', 'Paletas', '460', 'unidades', 1, 'paleta', 0, 20, 7, true),
  ('Pistacho', 'Pistacho', 'Paletas', 'Paletas', '464', 'unidades', 1, 'paleta', 0, 20, 8, true),
  ('Cookie & Cream', 'Cookie & Cream', 'Paletas', 'Paletas', '465', 'unidades', 1, 'paleta', 0, 20, 9, true),
  ('Frutos del Bosque', 'Frutos del Bosque', 'Paletas', 'Paletas', '467', 'unidades', 1, 'paleta', 0, 20, 10, true),
  ('Frutilla Natural', 'Frutilla Natural', 'Paletas', 'Paletas', '469', 'unidades', 1, 'paleta', 0, 20, 11, true),
  ('Piña Caramelo', 'Piña Caramelo', 'Paletas', 'Paletas', '470', 'unidades', 1, 'paleta', 0, 20, 12, true),
  ('Chocolate Dark Vegano', 'Chocolate Dark Vegano', 'Paletas', 'Paletas', '473', 'unidades', 1, 'paleta', 0, 20, 13, true),
  ('Frutilla Frambuesa Sin Azúcar', 'Frutilla Frambuesa Sin Azúcar', 'Paletas', 'Paletas', '481', 'unidades', 1, 'paleta', 0, 20, 14, true),
  ('Maracuyá Piña Mango Sin Azúcar', 'Maracuyá Piña Mango Sin Azúcar', 'Paletas', 'Paletas', '483', 'unidades', 1, 'paleta', 0, 20, 15, true),
  ('Bombom Frambuesa', 'Bombom Frambuesa', 'Paletas', 'Paletas', '492', 'unidades', 1, 'paleta', 0, 20, 16, true),
  ('Vainilla Mor', 'Vainilla Mor', 'Paletas', 'Paletas', '493', 'unidades', 1, 'paleta', 0, 20, 17, true),
  ('Mango Maracuyá', 'Mango Maracuyá', 'Mis Paletas', 'Paletas', '451NH', 'unidades', 1, 'paleta', 0, 20, 1, true),
  ('Frambuesa del Huerto', 'Frambuesa del Huerto', 'Mis Paletas', 'Paletas', '454NH', 'unidades', 1, 'paleta', 0, 20, 2, true),
  ('Limón Menta Jengibre', 'Limón Menta Jengibre', 'Mis Paletas', 'Paletas', '455NH', 'unidades', 1, 'paleta', 0, 20, 3, true),
  ('Manjar Nuez', 'Manjar Nuez', 'Mis Paletas', 'Paletas', '457NH', 'unidades', 1, 'paleta', 0, 20, 4, true),
  ('Chocolate Nutella', 'Chocolate Nutella', 'Mis Paletas', 'Paletas', '458NH', 'unidades', 1, 'paleta', 0, 20, 5, true),
  ('Arándano Limón', 'Arándano Limón', 'Mis Paletas', 'Paletas', '463NH', 'unidades', 1, 'paleta', 0, 20, 6, true),
  ('Pistacho', 'Pistacho', 'Mis Paletas', 'Paletas', '464NH', 'unidades', 1, 'paleta', 0, 20, 7, true),
  ('Frutilla Natural', 'Frutilla Natural', 'Mis Paletas', 'Paletas', '469NH', 'unidades', 1, 'paleta', 0, 20, 8, true),
  ('Piña Caramelo', 'Piña Caramelo', 'Mis Paletas', 'Paletas', '470NH', 'unidades', 1, 'paleta', 0, 20, 9, true),
  ('Chocolate Dark Vegano', 'Chocolate Dark Vegano', 'Mis Paletas', 'Paletas', '473NH', 'unidades', 1, 'paleta', 0, 20, 10, true),
  ('Frutilla-Frambuesa Sin Azúcar', 'Frutilla-Frambuesa Sin Azúcar', 'Mis Paletas', 'Paletas', '481NH', 'unidades', 1, 'paleta', 0, 20, 11, true),
  ('Maracuyá-Piña-Mango Sin Azúcar', 'Maracuyá-Piña-Mango Sin Azúcar', 'Mis Paletas', 'Paletas', '483NH', 'unidades', 1, 'paleta', 0, 20, 12, true),
  ('Bombom Frambuesa', 'Bombom Frambuesa', 'Mis Paletas', 'Paletas', '492NH', 'unidades', 1, 'paleta', 0, 20, 13, true),
  ('Vainilla Mor', 'Vainilla Mor', 'Mis Paletas', 'Paletas', '493NH', 'unidades', 1, 'paleta', 0, 20, 14, true),
  ('Cookies & Cream', 'Cookies & Cream', 'Gelato Premium Bachas', 'Gelato Premium', '501', 'unidades', 5, 'L', 0, 3, 1, true),
  ('Chocolate Nutella', 'Chocolate Nutella', 'Gelato Premium Bachas', 'Gelato Premium', '502', 'unidades', 5, 'L', 0, 3, 2, true),
  ('Alfajor', 'Alfajor', 'Gelato Premium Bachas', 'Gelato Premium', '503', 'unidades', 5, 'L', 0, 3, 3, true),
  ('Frutos del Bosque', 'Frutos del Bosque', 'Gelato Premium Bachas', 'Gelato Premium', '504', 'unidades', 5, 'L', 0, 3, 4, true),
  ('Mango Maracuyá', 'Mango Maracuyá', 'Gelato Premium Bachas', 'Gelato Premium', '505', 'unidades', 5, 'L', 0, 3, 5, true),
  ('Frambuesa Sin Azúcar', 'Frambuesa Sin Azúcar', 'Gelato Premium Bachas', 'Gelato Premium', '506', 'unidades', 5, 'L', 0, 3, 6, true),
  ('Pistacho Italiano', 'Pistacho Italiano', 'Gelato Premium Bachas', 'Gelato Premium', '507', 'unidades', 5, 'L', 0, 3, 7, true),
  ('Yogurt Griego Frambuesa', 'Yogurt Griego Frambuesa', 'Gelato Premium Bachas', 'Gelato Premium', '508', 'unidades', 5, 'L', 0, 3, 8, true),
  ('Manjar Nuez', 'Manjar Nuez', 'Gelato Premium Bachas', 'Gelato Premium', '509', 'unidades', 5, 'L', 0, 3, 9, true),
  ('Vainilla Bourbon', 'Vainilla Bourbon', 'Gelato Premium Bachas', 'Gelato Premium', '510', 'unidades', 5, 'L', 0, 3, 10, true),
  ('Chocolate Sin Azúcar', 'Chocolate Sin Azúcar', 'Gelato Premium Bachas', 'Gelato Premium', '511', 'unidades', 5, 'L', 0, 3, 11, true),
  ('Vainilla Sin Azúcar', 'Vainilla Sin Azúcar', 'Gelato Premium Bachas', 'Gelato Premium', '512', 'unidades', 5, 'L', 0, 3, 12, true),
  ('Cheesecake Frambuesa', 'Cheesecake Frambuesa', 'Gelato Premium Bachas', 'Gelato Premium', '513', 'unidades', 5, 'L', 0, 3, 13, true),
  ('Vainilla Tahitiana (Blanca)', 'Vainilla Tahitiana (Blanca)', 'Gelato Premium Bachas', 'Gelato Premium', '517', 'unidades', 5, 'L', 0, 3, 14, true),
  ('Chocolate 80% Cacao Belga', 'Chocolate 80% Cacao Belga', 'Gelato Premium Bachas', 'Gelato Premium', '519', 'unidades', 5, 'L', 0, 3, 15, true),
  ('Chocolate Dark Vegano', 'Chocolate Dark Vegano', 'Gelato Premium Bachas', 'Gelato Premium', '534', 'unidades', 5, 'L', 0, 3, 16, true),
  ('Snickers', 'Snickers', 'Gelato Premium Bachas', 'Gelato Premium', '540', 'unidades', 5, 'L', 0, 3, 17, true),
  ('After Eight (Menta)', 'After Eight (Menta)', 'Gelato Premium Bachas', 'Gelato Premium', '541', 'unidades', 5, 'L', 0, 3, 18, true),
  ('Cookies & Cream', 'Cookies & Cream', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '501', 'unidades', 6, 'x750ml', 0, 3, 1, true),
  ('Chocolate Nutella', 'Chocolate Nutella', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '502', 'unidades', 6, 'x750ml', 0, 3, 2, true),
  ('Alfajor', 'Alfajor', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '503', 'unidades', 6, 'x750ml', 0, 3, 3, true),
  ('Frutos del Bosque', 'Frutos del Bosque', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '504', 'unidades', 6, 'x750ml', 0, 3, 4, true),
  ('Mango Maracuyá', 'Mango Maracuyá', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '505', 'unidades', 6, 'x750ml', 0, 3, 5, true),
  ('Frambuesa Sin Azúcar', 'Frambuesa Sin Azúcar', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '506', 'unidades', 6, 'x750ml', 0, 3, 6, true),
  ('Pistacho Italiano', 'Pistacho Italiano', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '507', 'unidades', 6, 'x750ml', 0, 3, 7, true),
  ('Yogurt Griego Frambuesa', 'Yogurt Griego Frambuesa', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '508', 'unidades', 6, 'x750ml', 0, 3, 8, true),
  ('Manjar Nuez', 'Manjar Nuez', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '509', 'unidades', 6, 'x750ml', 0, 3, 9, true),
  ('Vainilla Bourbon', 'Vainilla Bourbon', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '510', 'unidades', 6, 'x750ml', 0, 3, 10, true),
  ('Chocolate Sin Azúcar', 'Chocolate Sin Azúcar', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '511', 'unidades', 6, 'x750ml', 0, 3, 11, true),
  ('Vainilla Sin Azúcar', 'Vainilla Sin Azúcar', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '512', 'unidades', 6, 'x750ml', 0, 3, 12, true),
  ('Cheesecake Frambuesa', 'Cheesecake Frambuesa', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '513', 'unidades', 6, 'x750ml', 0, 3, 13, true),
  ('Vainilla Tahitiana (Blanca)', 'Vainilla Tahitiana (Blanca)', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '517', 'unidades', 6, 'x750ml', 0, 3, 14, true),
  ('Chocolate 80% Cacao Belga', 'Chocolate 80% Cacao Belga', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '519', 'unidades', 6, 'x750ml', 0, 3, 15, true),
  ('Chocolate Dark Vegano', 'Chocolate Dark Vegano', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '534', 'unidades', 6, 'x750ml', 0, 3, 16, true),
  ('Snickers', 'Snickers', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '540', 'unidades', 6, 'x750ml', 0, 3, 17, true),
  ('After Eight (Menta)', 'After Eight (Menta)', 'Gelato Premium Caja 6x750ml', 'Gelato Premium', '541', 'unidades', 6, 'x750ml', 0, 3, 18, true);
-- total filas: 115


-- ===========================================================
-- 4) Tablas nuevas: movimientos_inventario, conteos, conteo_detalle
-- ===========================================================

create table if not exists movimientos_inventario (
  id uuid default gen_random_uuid() primary key,
  producto_id uuid references productos(id) not null,
  tipo_movimiento text not null check (tipo_movimiento in (
    'conteo', 'ajuste_por_conteo', 'produccion', 'venta_salida', 'merma', 'ajuste_manual'
  )),
  cantidad integer not null,
  stock_antes integer not null,
  stock_despues integer not null,
  motivo text,
  nota text,
  usuario_id uuid references auth.users(id),
  fecha date not null default current_date,
  created_at timestamp default now()
);

create table if not exists conteos (
  id uuid default gen_random_uuid() primary key,
  categoria_formato text not null,
  usuario_id uuid references auth.users(id),
  estado text not null default 'borrador' check (estado in ('borrador', 'finalizado')),
  observacion text,
  created_at timestamp default now(),
  finalized_at timestamp
);

create table if not exists conteo_detalle (
  id uuid default gen_random_uuid() primary key,
  conteo_id uuid references conteos(id) on delete cascade,
  producto_id uuid references productos(id),
  stock_sistema integer not null,
  stock_contado integer,
  diferencia integer,
  observacion text
);

create index if not exists idx_movimientos_producto_fecha on movimientos_inventario (producto_id, fecha desc);
create index if not exists idx_movimientos_tipo on movimientos_inventario (tipo_movimiento);
create index if not exists idx_conteo_detalle_conteo on conteo_detalle (conteo_id);
create index if not exists idx_productos_categoria on productos (categoria_formato);

alter table movimientos_inventario enable row level security;
alter table conteos enable row level security;
alter table conteo_detalle enable row level security;

create policy "Usuarios autenticados pueden leer/escribir movimientos_inventario"
  on movimientos_inventario for all
  to authenticated
  using (true)
  with check (true);

create policy "Usuarios autenticados pueden leer/escribir conteos"
  on conteos for all
  to authenticated
  using (true)
  with check (true);

create policy "Usuarios autenticados pueden leer/escribir conteo_detalle"
  on conteo_detalle for all
  to authenticated
  using (true)
  with check (true);


-- ===========================================================
-- 5) Funciones RPC
-- ===========================================================

-- registrar_movimiento: usado por Produccion rapida, Venta/salida
-- rapida y Merma/ajuste. Actualiza productos.stock_actual de forma
-- atomica y deja registro en movimientos_inventario.
--
--   p_tipo_movimiento: 'produccion' | 'venta_salida' | 'merma' | 'ajuste_manual'
--   p_cantidad: siempre positivo, salvo 'ajuste_manual' que admite
--               valores negativos (resta stock).
--   p_permitir_negativo: si es false (default), 'venta_salida' y
--               'merma' fallan si dejarian el stock bajo cero.
create or replace function registrar_movimiento(
  p_producto_id uuid,
  p_tipo_movimiento text,
  p_cantidad integer,
  p_motivo text default null,
  p_nota text default null,
  p_fecha date default current_date,
  p_permitir_negativo boolean default false
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
    (producto_id, tipo_movimiento, cantidad, stock_antes, stock_despues, motivo, nota, usuario_id, fecha)
  values
    (p_producto_id, p_tipo_movimiento, p_cantidad, v_stock_actual, v_nuevo, p_motivo, p_nota, v_usuario, p_fecha);

  return query select v_stock_actual, v_nuevo;
end;
$$;

-- crear_conteo: arma un conteo en borrador con una fila de
-- conteo_detalle por cada producto activo de la categoria_formato,
-- con stock_sistema = stock_actual al momento de crear el conteo.
create or replace function crear_conteo(
  p_categoria_formato text,
  p_observacion text default null
) returns uuid
language plpgsql
as $$
declare
  v_conteo_id uuid;
begin
  insert into conteos (categoria_formato, usuario_id, estado, observacion)
  values (p_categoria_formato, auth.uid(), 'borrador', p_observacion)
  returning id into v_conteo_id;

  insert into conteo_detalle (conteo_id, producto_id, stock_sistema)
  select v_conteo_id, p.id, p.stock_actual
  from productos p
  where p.categoria_formato = p_categoria_formato and p.activo = true
  order by p.orden;

  return v_conteo_id;
end;
$$;

-- finalizar_conteo: para cada fila contada (stock_contado not null)
-- con diferencia respecto al stock_sistema, actualiza
-- productos.stock_actual y crea un movimiento 'ajuste_por_conteo'.
-- Marca el conteo como 'finalizado'.
create or replace function finalizar_conteo(p_conteo_id uuid)
returns void
language plpgsql
as $$
declare
  r record;
  v_diferencia integer;
begin
  if exists (select 1 from conteos where id = p_conteo_id and estado = 'finalizado') then
    raise exception 'Este conteo ya fue finalizado';
  end if;

  for r in
    select cd.id, cd.producto_id, cd.stock_sistema, cd.stock_contado, cd.observacion
    from conteo_detalle cd
    where cd.conteo_id = p_conteo_id
      and cd.stock_contado is not null
  loop
    v_diferencia := r.stock_contado - r.stock_sistema;

    update conteo_detalle set diferencia = v_diferencia where id = r.id;

    if v_diferencia <> 0 then
      update productos
        set stock_actual = r.stock_contado, updated_at = now()
        where id = r.producto_id;

      insert into movimientos_inventario
        (producto_id, tipo_movimiento, cantidad, stock_antes, stock_despues, motivo, nota, usuario_id, fecha)
      values
        (r.producto_id, 'ajuste_por_conteo', v_diferencia, r.stock_sistema, r.stock_contado,
         'Ajuste por conteo fisico', r.observacion, auth.uid(), current_date);
    end if;
  end loop;

  update conteos set estado = 'finalizado', finalized_at = now() where id = p_conteo_id;
end;
$$;


-- ===========================================================
-- 6) Migrar historial de batches/ventas a movimientos_inventario
--    (solo afecta a los 18 productos antiguos, ahora activo=false)
-- ===========================================================

do $$
declare
  p record;
  m record;
  v_running integer;
  v_delta integer;
  v_nuevo integer;
  v_motivo text;
begin
  for p in select id from productos where codigo is null loop
    v_running := 0;

    for m in
      select 'produccion'::text as tipo, b.cantidad, b.fecha, b.created_at, b.usuario_id, b.notas, null::text as canal
         from batches b where b.producto_id = p.id
       union all
       select 'venta_salida'::text, v.cantidad, v.fecha, v.created_at, v.usuario_id, v.notas, v.canal
         from ventas v where v.producto_id = p.id
      order by fecha, created_at
    loop
      v_delta := case when m.tipo = 'produccion' then m.cantidad else -m.cantidad end;
      v_nuevo := v_running + v_delta;

      v_motivo := case
        when m.tipo = 'venta_salida' then
          case m.canal
            when 'presencial' then 'Venta'
            when 'distribuidor' then 'Distribuidor'
            else 'Otro'
          end
        else null
      end;

      insert into movimientos_inventario
        (producto_id, tipo_movimiento, cantidad, stock_antes, stock_despues, motivo, nota, usuario_id, fecha, created_at)
      values
        (p.id, m.tipo, m.cantidad, v_running, v_nuevo, v_motivo, m.notas, m.usuario_id, m.fecha, m.created_at);

      v_running := v_nuevo;
    end loop;

    update productos set stock_actual = v_running, updated_at = now() where id = p.id;
  end loop;
end $$;
