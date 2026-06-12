# Plan de expansión: Sustancias, Materias Primas, Trabajadores, Conservadoras y Clientes

> Análisis + plan de acción + crítica. No implementado todavía — esto es la base para decidir antes de escribir código/SQL.

## 1. Alcance solicitado

1. Inventario de **sustancias** (químicos/sanitizantes) — igual mecánica que el inventario de helados.
2. Inventario de **materias primas** (insumos de producción: leche, azúcar, saborizantes, etc.).
3. **Listado de trabajadores**: ficha de cada uno + contrato en PDF descargable.
4. **Inventario de conservadoras**: equipos entregados a clientes en distintas ubicaciones, con datos de contacto.
5. **Clientes frecuentes**: catálogo de clientes, conectado opcionalmente con Venta/salida ("vendido a tal cliente").

Todo esto detrás del flag `admin` (igual que Métricas/Configuración hoy).

---

## 2. Diagnóstico de lo que ya existe

- **Motor de inventario genérico**: `productos` + `movimientos_inventario` + `conteos`/`conteo_detalle`, con RPCs `registrar_movimiento`, `crear_conteo`, `finalizar_conteo`. Ya soporta categorías, unidades de medida, stock mínimo, conteos con planilla imprimible.
- **Rol admin actual**: es **100% cosmético**. `ADMIN_EMAILS` en `js/nav.js` solo decide qué links mostrar en el menú. La base de datos no distingue roles: cualquier usuario autenticado puede leer/escribir **todas** las tablas vía la API REST de Supabase (políticas RLS = `using (true)`).
- Esto fue aceptable hasta ahora porque todo era "inventario operativo" (sin datos sensibles). **Cambia con trabajadores/contratos** (RUT, sueldos potencialmente) — ahí sí importa.

---

## 3. Decisión de arquitectura: un motor, varios "almacenes" (no 3 sistemas paralelos)

**Crítica clave**: la tentación es clonar el patrón de `productos`/`conteos`/`movimientos` tres veces (helados, sustancias, materias primas). Eso triplica código, triplica bugs y triplica mantención cada vez que se agregue una función nueva (ej. el fix de "encargados" que hicimos hoy habría que aplicarlo 3 veces).

**Mejor enfoque**: extender las tablas existentes con una columna `tipo_item` (`'producto_terminado' | 'sustancia' | 'materia_prima'`) y reusar `movimientos_inventario`, `conteos`, `conteo_detalle` y las 3 funciones RPC tal cual — ya son genéricas (trabajan sobre `producto_id`, no saben de helados).

Lo que sí difiere por tipo:
- **Sustancias**: agregar columnas opcionales `ficha_seguridad_url` (link a hoja de seguridad/SDS), `tipo_sustancia` (detergente, sanitizante, plaguicida, etc.), `fecha_vencimiento`.
- **Materias primas**: agregar `proveedor`, `lote`, `fecha_vencimiento`, `unidad_medida` (kg, L, unidades — ya existe `unidad_contenido`).
- La constraint `categoria_formato_check` se relaja para aceptar nuevas categorías (ej. `'Limpieza'`, `'Sanitización'`, `'Lácteos'`, `'Insumos secos'`, etc.) o se reemplaza por un esquema de categorías libres validado por una tabla `categorias` en vez de un `check` hardcodeado (más flexible a futuro).

UI: páginas nuevas `sustancias.html` y `materias-primas.html`, pero reusando ~80% de `conteo.js`/`stock.js`/`metricas.js` parametrizados por `tipo_item`. Las planillas imprimibles también se generalizan.

**Resultado**: 1 motor, 3 "vistas" de inventario, código compartido, un solo lugar para arreglar bugs.

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

### 5.1 Inventario de Sustancias
- Reusa motor genérico (sección 3). Categorías sugeridas: Limpieza, Sanitización, Plagas/control.
- Campos extra: `ficha_seguridad_url`, `tipo_sustancia`, `fecha_vencimiento`.
- Página `sustancias.html` (admin) con stock, conteo, planilla imprimible — igual flujo que helados.
- Alertas de stock mínimo y vencimiento próximo (campo ya existe `stock_minimo`, agregar lógica de vencimiento en Métricas).

### 5.2 Inventario de Materias Primas
- Igual mecánica. Campos extra: `proveedor`, `lote`, `fecha_vencimiento`.
- Útil para planificar compras (cruzar con producción futura — *fuera de alcance por ahora*, pero la estructura lo permite después).
- Página `materias-primas.html` (admin).

### 5.3 Trabajadores + contratos
- Tabla `trabajadores`: nombre, RUT, cargo, fecha_ingreso, teléfono, email, estado (activo/inactivo), contrato_path (ruta en Storage), notas.
- Página `trabajadores.html` (admin): tabla editable (mismo patrón que "Encargados" en Configuración) + botón "Subir contrato" (PDF) y "Descargar" (signed URL).
- **Requiere** la sección 4 (roles reales + bucket privado) antes de cargar datos reales.
- Dato sensible: RUT es un identificador gubernamental (Ley 19.628). Mantenerlo solo en esta tabla protegida, no exponerlo en exports generales (Excel) salvo que sea necesario.

### 5.4 Clientes frecuentes (tabla central)
- Tabla `clientes`: nombre, tipo (distribuidor/persona/empresa), contacto_telefono, contacto_email, ubicación, notas, activo.
- `venta.html`/`js/venta.js`: agregar selector opcional "Vendido a" (mismo patrón que el selector de "Encargado" en conteo) → guarda `cliente_id` en `movimientos_inventario` (columna nueva, nullable).
- Página `clientes.html` (admin): CRUD simple, tabla editable.
- Esta tabla se vuelve la referencia central para 5.5.

### 5.5 Inventario de conservadoras (activos en terreno)
- Tabla `conservadoras`: código/serie, modelo, `cliente_id` (FK a `clientes`), fecha_entrega, estado (en uso/mantención/devuelta), ubicación específica (si difiere de la del cliente), notas.
- Al usar `cliente_id` en vez de duplicar nombre/teléfono/email/ubicación, los datos de contacto se editan en un solo lugar (`clientes`) y se reflejan en todas las conservadoras de ese cliente.
- Página `conservadoras.html` (admin): tabla + filtro por cliente/estado. Mismo patrón de tabla editable que Configuración.
- *Idea a futuro* (no para esta fase): código QR por conservadora para escanear en terreno y ver/actualizar estado desde el celular.

---

## 6. Orden de implementación propuesto

Pediste partir por inventario (sustancias/MP) porque es extensión directa de lo existente. Propongo este orden, con dependencias marcadas:

| Fase | Módulo | SQL | Complejidad | Depende de |
|---|---|---|---|---|
| 1 | Sustancias + Materias Primas (motor genérico extendido) | `migration_v5_almacenes.sql` | Media | — |
| 2 | Roles reales en BD (`perfiles`, `es_admin()`, RLS) | `migration_v6_roles.sql` | Media | — (puede ir en paralelo a Fase 1) |
| 3 | Clientes frecuentes + integración Venta | `migration_v7_clientes.sql` | Baja-Media | Fase 2 (si se restringe acceso a clientes) |
| 4 | Conservadoras | `migration_v8_conservadoras.sql` | Baja | Fase 3 (usa `clientes`) |
| 5 | Trabajadores + contratos (Storage) | `migration_v9_trabajadores.sql` + bucket | Media-Alta | Fase 2 (RLS real obligatoria) |

Sugerencia: hacer Fase 1 y 2 juntas en la próxima sesión (ambas son "infraestructura"), y desde ahí ir módulo por módulo validando con datos reales antes de seguir — evita acumular 5 features sin probar.

---

## 7. Crítica general y riesgos

- **No dupliques el motor de inventario** (sección 3) — es el riesgo más grande de este plan si se apura. Vale la pena la sesión extra de diseño ahora para no mantener 3 copias después.
- **Roles reales antes de Trabajadores**, no después. Si se carga un contrato real antes de tener RLS real, queda expuesto aunque sea "por poco tiempo".
- **RUT y datos personales**: trabajadores y clientes son los primeros datos personales reales del sistema. Mantenerlos solo en las tablas protegidas, y no incluirlos en los exports a Excel existentes salvo que se agregue explícitamente.
- **Uso en terreno (conservadoras)**: hoy el sistema se usa en la heladería (PC/tablet). Si alguien va a actualizar el estado de una conservadora donde un cliente, probablemente sea desde el celular — vale la pena revisar que las tablas editables (patrón Configuración) sean usables en mobile, igual que se hizo con `conteo.html`.
- **Alcance total es grande**: 5 tablas nuevas + RLS real + Storage + 5 páginas nuevas + cambios en Venta/Métricas. Recomiendo tratarlo como 5 sesiones de trabajo, no una sola, con commit y prueba real entre cada una (mismo ritmo que se ha usado hasta ahora).
- **Nomenclatura**: usar nombres consistentes con lo existente (`activo`, `orden`, `created_at`, patrón de tabla editable de Configuración) para que el código nuevo se sienta parte del mismo sistema, no un agregado aparte.

---

## 8. Próximo paso sugerido

Si te parece bien el orden, empezar por **Fase 1 (Sustancias + Materias Primas)**: escribir `migration_v5_almacenes.sql` (alter de `productos`/`movimientos_inventario`/`conteos` + nuevas categorías) y las páginas `sustancias.html` / `materias-primas.html` reusando `conteo.js`/`stock.js` generalizados. En paralelo o inmediatamente después, Fase 2 (roles reales) para dejar el terreno preparado antes de Trabajadores.
