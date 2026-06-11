# Mepiache Inventario

Sistema interno de inventario para la heladería Mepiache. Registra producción
(batches), ventas/salidas y muestra el stock actual de helados de 5L y 10L.

## Estado actual

**Conectado a Supabase.** Login real (Supabase Auth) y datos persistentes
en PostgreSQL (tablas `productos`, `batches`, `ventas`).

- `index.html` — login (Supabase Auth, email + contraseña)
- `dashboard.html` — app principal (Stock / Producción / Ventas)
- `css/styles.css` — estilos con la identidad visual de Mepiache
- `js/supabase-config.js` — credenciales del proyecto (URL + anon key).
  Se sube al repo a propósito: la *anon key* está diseñada para ser pública
  (queda visible en el navegador igual); la seguridad real la dan las
  políticas RLS de `sql/schema.sql`. Lo único que nunca debe subirse es la
  *service_role key* (no se usa en este proyecto).
- `js/data.js` — queries a Supabase (productos, batches, ventas, cálculo de stock)
- `js/auth.js` — login/sesión con Supabase Auth
- `js/app.js` — lógica del dashboard
- `sql/schema.sql` — script ya ejecutado en Supabase (tablas, RLS, catálogo)
- `robots.txt` + meta `noindex` — evita que buscadores indexen esta app interna

## Cómo probarlo

Abrir `index.html` en el navegador (doble clic, o con una extensión tipo
"Live Server"). Login con el email/contraseña de un usuario creado en
**Authentication > Users** del proyecto Supabase.

## Checklist Supabase

- [x] Proyecto Supabase creado
- [x] `sql/schema.sql` ejecutado (tablas, RLS y catálogo de 18 sabores)
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

- El contexto original dice "12 sabores" para helados 5L, pero solo se
  listaron 11 nombres. Falta confirmar el sabor que falta y agregarlo en
  `js/data.js` y `sql/schema.sql`.
- Umbral de "stock bajo" (hoy: 10 unidades) — ajustar según criterio real
  del negocio.

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
