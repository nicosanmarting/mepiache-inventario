# Contexto para el proyecto: Sistema de Inventario Mepiache

> Llevar este archivo al Cowork nuevo (carpeta `mepiache-inventario`) como primer mensaje/contexto.

## Sobre el negocio
Mepiache: heladería artesanal familiar, 70 años de historia, San Joaquín (Santiago, Chile). Vende a distribuidores (B2B) y público general. Sitio web: https://mepiache.vercel.app (proyecto separado, no tocar desde aquí).

## Qué se necesita construir
Sistema interno de inventario, enfocado en **helados de 5 y 10 litros**.

- **Usuarios:** Nico (admin) + 1 empleado de la heladería. Login requerido.
- **Acceso:** computador o tablet en la heladería.
- **Funciones core:**
  - Registrar **producción** (nuevo batch): producto + sabor + formato + cantidad + fecha
  - Registrar **ventas/salidas**: producto + cantidad + fecha + canal
  - Ver **stock actual** = producción acumulada − ventas acumuladas
  - Métricas básicas más adelante (productos más vendidos, rotación, etc.)
- **Frontend amigable**, simple, sin frameworks complejos (igual que el sitio web: HTML/CSS/JS plano).

## Stack elegido
**Supabase** (PostgreSQL + Auth + API REST automática). Plan free.

### Esquema SQL ya definido (ejecutar en SQL Editor de Supabase)
```sql
create table productos (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  sabor text not null,
  formato text not null,  -- '5L' o '10L'
  activo boolean default true,
  created_at timestamp default now()
);

create table batches (
  id uuid default gen_random_uuid() primary key,
  producto_id uuid references productos(id),
  cantidad integer not null,
  fecha date not null,
  usuario_id uuid references auth.users(id),
  notas text,
  created_at timestamp default now()
);

create table ventas (
  id uuid default gen_random_uuid() primary key,
  producto_id uuid references productos(id),
  cantidad integer not null,
  fecha date not null,
  canal text default 'presencial',
  usuario_id uuid references auth.users(id),
  notas text,
  created_at timestamp default now()
);
```

## Sabores reales (de productos.json del sitio web)

### Helados 5 Litros (12 sabores)
Arroz con leche, Banana Split, Café Capuchino, Chirimoya Alegre, Chocolate Clásico, Frambuesa, Frutos del Bosque, Lúcuma Manjar, Piña al Agua, Pistacho, Vainilla

### Helados 10 Litros (7 sabores, "según temporada y stock")
Chocolate, Frutilla, Vainilla, Lúcuma, Frambuesa, Chirimoya Alegre, Manjar

> Usar estos nombres tal cual para poblar la tabla `productos` (un registro por sabor × formato).

## Identidad visual (por si se quiere frontend con cara de marca)
- Negro: `#0C0C0C` · Dorado: `#C8941A` · Dorado claro: `#E8B84B`
- Crema: `#F5E6C8` · Crema suave: `#FAF3E6` · Crema oscura: `#EDE0CC`
- Tipografías: Georgia (serif, títulos) + Arial (sans, cuerpo)

## Roadmap / visión a futuro (de arquitectura.md del sitio)
1. Sitio web (listo)
2. **Sistema de inventario** ← este proyecto
3. Sistema de pedidos (formulario web → BD → notificación)
4. Logística (despachos, rutas, entregas)
5. Clientes/distribuidores (historial, precios diferenciados)
6. Pagos online (Transbank / Mercado Pago)

**Conexión futura (lejana) con el sitio web:** el inventario alimentaría una "pantalla media" (capa intermedia) que decide qué productos mostrar como disponibles en la web — no es conexión directa, es un filtro indirecto. No implementar ahora, solo tenerlo en mente al diseñar la estructura de datos para que sea compatible después.

## Checklist antes de empezar a construir
- [ ] Carpeta `mepiache-inventario/` creada
- [ ] Repo en GitHub creado y conectado (`git init` + `git remote add origin ...`)
- [ ] Proyecto Supabase creado (región São Paulo, plan free)
- [ ] Tablas creadas (SQL de arriba ejecutado)
- [ ] Usuarios invitados (Nico + empleado) en Authentication
- [ ] `Project URL` y `anon public key` guardados (Settings → API)
