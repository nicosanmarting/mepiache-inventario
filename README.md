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
  **No se sube a GitHub** (está en `.gitignore`)
- `js/data.js` — queries a Supabase (productos, batches, ventas, cálculo de stock)
- `js/auth.js` — login/sesión con Supabase Auth
- `js/app.js` — lógica del dashboard
- `sql/schema.sql` — script ya ejecutado en Supabase (tablas, RLS, catálogo)

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

## Si clonas el repo en otro computador

`js/supabase-config.js` no está en git (tiene credenciales). Para que la app
funcione hay que recrearlo con:

```js
const SUPABASE_URL = 'https://jivccnpqangjckoxakyi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...'; // anon public key, desde Settings > API Keys

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

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
