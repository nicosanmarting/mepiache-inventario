# Mepiache Inventario

Sistema interno de inventario para la heladería Mepiache. Registra producción
(batches), ventas/salidas y muestra el stock actual de helados de 5L y 10L.

## Estado actual

Este es el **frontend funcional con datos de prueba**. Todo corre en el
navegador con `localStorage` como base de datos simulada — no hay conexión
real a Supabase todavía.

- `index.html` — login (mock: `admin/admin` o `empleado/empleado`)
- `dashboard.html` — app principal (Stock / Producción / Ventas)
- `css/styles.css` — estilos con la identidad visual de Mepiache
- `js/data.js` — catálogo de productos + datos de prueba + cálculo de stock
- `js/auth.js` — login simulado
- `js/app.js` — lógica del dashboard
- `sql/schema.sql` — script para crear las tablas en Supabase

## Cómo probarlo

Abrir `index.html` en el navegador (doble clic, o con una extensión tipo
"Live Server" si quieres recargar más cómodo). Login con `admin / admin`.

Los datos de producción/ventas que registres quedan guardados en el
navegador. Hay un botón **"Reiniciar demo"** para volver a los datos
iniciales.

## Checklist para conectar Supabase (pendiente)

- [x] Proyecto Supabase creado
- [ ] Ejecutar `sql/schema.sql` en el SQL Editor de Supabase (crea tablas,
      políticas de seguridad y carga el catálogo de sabores)
- [ ] Activar Authentication > Email (o el método que prefieras) e invitar
      a los 2 usuarios (Nico admin + empleado)
- [ ] Copiar `Project URL` y `anon public key` desde Settings → API
- [ ] Crear `js/supabase-config.js` (no se sube a GitHub, está en
      `.gitignore`) con:

  ```js
  const SUPABASE_URL = 'https://xxxxx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
  ```

- [ ] Reemplazar `js/data.js` y `js/auth.js`:
  - `auth.js`: cambiar el login mock por
    `supabase.auth.signInWithPassword({ email, password })`
  - `data.js`: cambiar `localStorage` por consultas a Supabase
    (`select`, `insert` en `productos`, `batches`, `ventas`).
    Los nombres de campos ya están alineados para que el cambio sea directo.
  - Cargar el SDK de Supabase vía CDN en los `.html`:
    `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`

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
