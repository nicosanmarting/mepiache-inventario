# Mepiache Inventario

Sistema interno de inventario operativo para la heladería Mepiache. Permite
registrar conteos de stock, producción, ventas/salidas y mermas, y muestra el
stock actual por sabor/formato.

## Estado actual (v2 — operativo)

**Conectado a Supabase.** Login real (Supabase Auth) y datos persistentes en
PostgreSQL (tablas `productos`, `movimientos_inventario`, `conteos`,
`conteo_detalle`).

### Páginas

- `index.html` — login (Supabase Auth, email + contraseña)
- `inicio.html` — accesos rápidos + resumen de stock, último conteo y
  últimos movimientos
- `conteo.html` — nuevo conteo / continuar conteo en curso, por
  categoría/formato
- `produccion.html` — registro rápido de producción
- `venta.html` — registro rápido de venta/salida
- `merma.html` — registro de merma/ajuste (solo admin)
- `stock.html` — stock actual, filtrable, con accesos directos a
  producción/venta/merma por producto
- `historial.html` — historial de movimientos de inventario, filtrable
- `metricas.html` — métricas mensuales, gráficos, ranking de ventas y
  exportación a Excel (solo admin)
- `configuracion.html` — alta y edición del catálogo de productos (solo
  admin)
- `dashboard.html` — antigua app (v1), ahora redirige a `inicio.html`

### Roles

El rol "admin" se define por una lista de emails hardcodeada en
`js/nav.js` (`ADMIN_EMAILS`). Los usuarios fuera de esa lista tienen el rol
"operativo" y no ven Merma/ajuste, Métricas ni Configuración.

### Archivos clave

- `css/styles.css` — estilos con la identidad visual de Mepiache
- `js/supabase-config.js` — credenciales del proyecto (URL + anon key).
  Se sube al repo a propósito: la *anon key* está diseñada para ser pública
  (queda visible en el navegador igual); la seguridad real la dan las
  políticas RLS de `sql/`. Lo único que nunca debe subirse es la
  *service_role key* (no se usa en este proyecto).
- `js/data.js` — todas las queries/RPC a Supabase (productos, stock,
  movimientos, conteos, métricas, configuración)
- `js/nav.js` — layout compartido (header + navegación por rol), sesión y
  utilidades de fecha
- `js/movimiento.js` — lógica compartida por producción/venta/merma
  (`initMovimientoPage`)
- `js/auth.js` — login/sesión con Supabase Auth
- `sql/schema.sql` — esquema original (v1)
- `sql/migration_v2_inventario.sql` — migración a inventario operativo
  (catálogo de 115 productos, `movimientos_inventario`, `conteos`,
  `conteo_detalle`, RPCs `registrar_movimiento` / `crear_conteo` /
  `finalizar_conteo`)
- `sql/migration_v3_productos_rls.sql` — políticas RLS faltantes en
  `productos` (UPDATE/INSERT), necesarias para que las RPCs de movimientos y
  la pantalla de Configuración funcionen. **Pendiente de ejecutar en
  Supabase.**
- `robots.txt` + meta `noindex` — evita que buscadores indexen esta app interna

## Cómo probarlo

Abrir `index.html` en el navegador (doble clic, o con una extensión tipo
"Live Server"). Login con el email/contraseña de un usuario creado en
**Authentication > Users** del proyecto Supabase.

## Checklist Supabase

- [x] Proyecto Supabase creado
- [x] `sql/schema.sql` ejecutado (esquema original)
- [x] `sql/migration_v2_inventario.sql` ejecutado (catálogo nuevo + tablas de
      movimientos/conteos + RPCs)
- [ ] `sql/migration_v3_productos_rls.sql` ejecutado (políticas RLS de
      `productos` para UPDATE/INSERT)
- [x] Usuarios creados en Authentication (Nico admin + empleado)
- [x] `js/supabase-config.js` creado con Project URL + anon key
- [x] `auth.js` y `data.js` conectados a Supabase

## Deploy a producción (Vercel)

1. **Subir a GitHub**: crear el repo, `git remote add origin <url>` y
   `git push -u origin master`.
2. **Vercel**: [vercel.com](https://vercel.com) → New Project → importar el
   repo. Framework preset: **Other** (es un sitio estático, no necesita build
   ni variables de entorno — `js/supabase-config.js` ya viaja en el repo).
3. Deploy. Vercel queda escuchando el branch `master`: cada push hace deploy
   automático.
4. **Configurar Supabase para el dominio de producción**:
   - Authentication → URL Configuration
   - **Site URL**: poner la URL que te da Vercel (ej.
     `https://mepiache-inventario.vercel.app`)
   - **Redirect URLs**: agregar la misma URL (y `http://localhost` /
     `file://` si quieres seguir probando local)
5. (Opcional) Dominio propio: Vercel → Settings → Domains, agregar algo como
   `inventario.mepiache.cl` (requiere configurar DNS).

La app es de uso interno — `robots.txt` y meta `noindex` ya evitan que
aparezca en buscadores, pero sigue siendo accesible por URL directa para
cualquiera con el link. Si se quiere más privacidad, se puede restringir por
contraseña a nivel de Vercel (plan Pro) o dejarlo solo en un dominio interno.

## Pendiente / a confirmar

- Ejecutar `sql/migration_v3_productos_rls.sql` en el SQL Editor de
  Supabase (necesario para que producción/venta/merma/conteo y
  Configuración puedan escribir en `productos`).
- Revisar el catálogo de 115 productos en `configuracion.html` y ajustar
  códigos, stock mínimo y orden según el criterio real del negocio.
- `js/app.js` quedó vacío (deprecado) por restricciones de permisos del
  entorno para borrar archivos; se puede eliminar manualmente cuando se
  quiera.

## Roadmap (visión general del proyecto)

1. Sitio web (listo, proyecto separado)
2. **Sistema de inventario** ← este proyecto
3. Sistema de pedidos
4. Logística
5. Clientes/distribuidores
6. Pagos online

No implementar los puntos 3-6 todavía, pero la estructura de datos
(productos por sabor/formato) está pensada para ser compatible cuando
llegue el momento.
