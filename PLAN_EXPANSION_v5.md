# Plan de expansión: Sustancias, Trabajadores y Conservadoras

> Análisis + plan de acción + crítica. No implementado todavía — esto es la base para decidir antes de escribir código/SQL.

## 0. Corrección de alcance (vs. versión anterior de este plan)

- **"Sustancias" NO son químicos/sanitizantes** — es **otro producto comestible** que vende Mepiache, con **4 tipos** y **2 formatos de venta** cada uno (8 combinaciones, igual lógica que Helados/Paletas/Gelato hoy). Catálogo pendiente: Nico lo entrega mañana.
- Dado que es "lo mismo que ya existe pero con otro catálogo", **no necesita arquitectura nueva** — es extender `productos`/`categoria_formato` con las nuevas categorías y cargar el catálogo, igual que se hizo en `migration_v2_inventario.sql`. Se retoma apenas llegue la info.
- **Materias primas y "Clientes frecuentes" como módulo propio quedan fuera del alcance inmediato** (no se mencionaron en el último mensaje). Se pueden retomar después si hace falta.
- **Bajo "admin" el alcance confirmado ahora es**: Listado de trabajadores (con contrato PDF) e Inventario de conservadoras.

## 1. Alcance solicitado (actualizado)

1. **Sustancias** (producto comestible, 4 tipos x 2 formatos) — extensión de catálogo, pendiente de info (mañana).
2. **Listado de trabajadores**: ficha de cada uno + contrato en PDF descargable. (admin)
3. **Inventario de conservadoras**: equipos entregados a clientes en distintas ubicaciones, con datos de contacto. (admin)

Todo esto detrás del flag `admin` (igual que Métricas/Configuración hoy), salvo el catálogo de Sustancias que es parte del inventario operativo normal.

---

## 2. Diagnóstico de lo que ya existe

- **Motor de inventario genérico**: `productos` + `movimientos_inventario` + `conteos`/`conteo_detalle`, con RPCs `registrar_movimiento`, `crear_conteo`, `finalizar_conteo`. Ya soporta categorías, unidades de medida, stock mínimo, conteos con planilla imprimible.
- **Rol admin actual**: es **100% cosmético**. `ADMIN_EMAILS` en `js/nav.js` solo decide qué links mostrar en el menú. La base de datos no distingue roles: cualquier usuario autenticado puede leer/escribir **todas** las tablas vía la API REST de Supabase (políticas RLS = `using (true)`).
- Esto fue aceptable hasta ahora porque todo era "inventario operativo" (sin datos sensibles). **Cambia con trabajadores/contratos** (RUT, sueldos potencialmente) — ahí sí importa.

---

## 3. Sustancias: extensión simple del catálogo existente

Como "Sustancias" es **otro producto comestible** con 4 tipos x 2 formatos (8 combinaciones), encaja directo en el modelo actual: es lo mismo que se hizo en `migration_v2_inventario.sql` al cargar los 115 productos de Helados/Paletas/Gelato.

Cuando llegue el catálogo (mañana), el trabajo es:
1. `migration_v5_sustancias.sql`: agregar las nuevas categorías a `productos_categoria_formato_check` (ej. `'Sustancia Formato A'`, `'Sustancia Formato B'` — nombres reales según el catálogo) y `insert into productos (...)` con los SKUs nuevos (igual estructura: código, nombre, sabor/variante, categoria_formato, unidad_conteo, contenido, stock_actual=0, stock_minimo, orden).
2. Como `conteo.js`, `stock.js`, `metricas.js`, `configuracion.js` ya leen `getCategorias()`/`getProductosPorCategoria()` de forma genérica, **las nuevas categorías aparecen solas** en Nuevo conteo, Stock actual, Métricas y Configuración — sin tocar código, salvo quizás la planilla imprimible (`imprimir-conteo.js`) si se quiere una hoja con el formato físico de esas planillas también.

No requiere arquitectura nueva ni `tipo_item`. Queda pendiente solo de la info del catálogo.

---

## 4. Punto crítico: roles reales en la base de datos (prerequisito para Trabajadores)

Para Trabajadores (RUT, contrato PDF, posible sueldo) **no basta con ocultar el link en el menú**. Cualquiera con sesión activa podría hacer `GET /rest/v1/trabajadores` directo y ver todo.

**Se necesita**:
1. Tabla `perfiles` (o `usuarios_app`): `id` (= `auth.users.id`), `email`, `rol` (`'admin' | 'operativo'`).
2. Función SQL `es_admin()` que chequea `perfiles.rol = 'admin'` para el usuario actual (`auth.uid()`).
3. Políticas RLS reales en tablas sensibles (`trabajadores`, `conservadoras`, `clientes` si tiene info de contacto sensible): `using (es_admin())`.
4. **Supabase Storage**: bucket privado `contratos`, con política que solo permite `select`/`insert` a `es_admin()`. Descarga vía `createSignedUrl` (URL temporal), nunca pública.

Esto es trabajo de fondo (no se "ve" en la UI) pero es la diferencia entre "el menú no muestra el botón" y "los datos están realmente protegidos". Recomiendo hacerlo **antes** de cargar el primer contrato real.

---

## 5. Diseño por módulo

### 5.1 Sustancias (catálogo nuevo)
- Ver sección 3. Pendiente de catálogo (mañana). Cuando llegue: `migration_v5_sustancias.sql` + carga de productos. Las páginas existentes lo absorben solas.

### 5.2 Trabajadores + contratos (admin)
- Tabla `trabajadores`: nombre, RUT, cargo, fecha_ingreso, teléfono, email, estado (activo/inactivo), contrato_path (ruta en Storage), notas.
- Página `trabajadores.html` (admin): tabla editable (mismo patrón que "Encargados" en Configuración) + botón "Subir contrato" (PDF) y "Descargar" (signed URL).
- **Requiere** la sección 4 (roles reales + bucket privado) antes de cargar datos reales.
- Dato sensible: RUT es un identificador gubernamental (Ley 19.628). Mantenerlo solo en esta tabla protegida, no exponerlo en exports generales (Excel) salvo que sea necesario.

### 5.3 Inventario de conservadoras (admin)
- Tabla `conservadoras`: código/serie, modelo, cliente (nombre), contacto_telefono, contacto_email, ubicación, fecha_entrega, estado (en uso/mantención/devuelta), notas.
- Para esta fase, los datos del cliente van **directo en la tabla `conservadoras`** (nombre/teléfono/email/ubicación), sin tabla `clientes` separada — es lo que pediste y no agrega una entidad nueva que hoy no se usa en otro lado. Si más adelante se retoma "clientes frecuentes" + Venta, se puede migrar a una tabla `clientes` con FK sin perder datos.
- Página `conservadoras.html` (admin): tabla editable, filtro por cliente/estado. Mismo patrón que Configuración.
- *Idea a futuro*: código QR por conservadora para escanear en terreno desde el celular.
- Dato de contacto de clientes (teléfono/email) es información de terceros, no tan sensible como RUT/contratos, pero igual conviene que viva detrás de `es_admin()` (sección 4) por prolijidad.

---

## 6. Orden de implementación propuesto

| Fase | Módulo | SQL | Complejidad | Depende de |
|---|---|---|---|---|
| 1 | Roles reales en BD (`perfiles`, `es_admin()`, RLS) | `migration_v5_roles.sql` | Media | — |
| 2 | Inventario de conservadoras | `migration_v6_conservadoras.sql` | Baja | Fase 1 |
| 3 | Trabajadores + contratos (Storage) | `migration_v7_trabajadores.sql` + bucket | Media-Alta | Fase 1 |
| 4 | Sustancias (catálogo nuevo) | `migration_v8_sustancias.sql` | Baja-Media | Catálogo (mañana) |

Conservadoras antes de Trabajadores porque no involucra Storage ni PDFs — más rápido de validar de punta a punta. Sustancias va aparte porque depende solo de la info del catálogo, no de las otras fases — se puede intercalar en cualquier momento que llegue esa info.

---

## 7. Crítica general y riesgos

- **Roles reales (Fase 1) son la base de todo lo demás** — sin esto, "admin" sigue siendo solo cosmético y los datos de trabajadores/conservadoras quedan técnicamente accesibles por cualquier usuario autenticado vía API. Vale la pena hacerla primero aunque no se "vea" en la UI.
- **RUT y datos personales**: trabajadores (y los contactos de clientes en conservadoras) son los primeros datos personales reales del sistema. Mantenerlos en tablas protegidas por `es_admin()`, y no incluirlos en los exports a Excel existentes salvo que se agregue explícitamente.
- **Uso en terreno (conservadoras)**: si alguien actualiza el estado de una conservadora donde un cliente, probablemente sea desde el celular — revisar que la tabla editable sea usable en mobile, igual que `conteo.html`.
- **Sustancias es bajo riesgo técnico** pero depende de info externa (catálogo) — no bloquea las otras dos fases, puede ir en paralelo cuando llegue.
- **Nomenclatura**: usar nombres consistentes con lo existente (`activo`, `orden`, `created_at`, patrón de tabla editable de Configuración).

---

## 8. Próximo paso sugerido

Empezar por **Fase 1 (roles reales)**: `migration_v5_roles.sql` con tabla `perfiles`, función `es_admin()`, y poblar `perfiles` con los emails que hoy están en `ADMIN_EMAILS`. Es la base para Conservadoras y Trabajadores. Luego **Fase 2 (conservadoras)** como primer módulo nuevo visible, y **Fase 3 (trabajadores)** con Storage. Sustancias se suma cuando llegue el catálogo.
