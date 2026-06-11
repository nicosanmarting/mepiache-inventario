/* ===========================
   Mepiache Inventario - Datos
   ---------------------------------------------
   Catálogo de productos (sabores reales del sitio web)
   + datos de prueba (producción y ventas) guardados
   en localStorage para simular una base de datos.

   Cuando Supabase esté listo, reemplazar:
     - PRODUCTOS           -> SELECT * FROM productos
     - getBatches/addBatch -> SELECT/INSERT en tabla "batches"
     - getVentas/addVenta  -> SELECT/INSERT en tabla "ventas"
   Los nombres de campos (producto_id, cantidad, fecha,
   canal, notas) ya están alineados con sql/schema.sql
   para que el cambio sea lo más directo posible.
   =========================== */

// --------- Catálogo de productos ---------
// NOTA: el contexto del sitio menciona "12 sabores" para 5L,
// pero solo se listaron 11 nombres. Se dejaron los 11 reales;
// agregar el sabor faltante cuando se confirme.

const PRODUCTOS = [
  // ---- Helados 5 Litros ----
  { id: 'p5-arroz-leche',       nombre: 'Arroz con Leche',     formato: '5L' },
  { id: 'p5-banana-split',      nombre: 'Banana Split',        formato: '5L' },
  { id: 'p5-cafe-capuchino',    nombre: 'Café Capuchino',      formato: '5L' },
  { id: 'p5-chirimoya-alegre',  nombre: 'Chirimoya Alegre',    formato: '5L' },
  { id: 'p5-chocolate-clasico', nombre: 'Chocolate Clásico',   formato: '5L' },
  { id: 'p5-frambuesa',         nombre: 'Frambuesa',           formato: '5L' },
  { id: 'p5-frutos-bosque',     nombre: 'Frutos del Bosque',   formato: '5L' },
  { id: 'p5-lucuma-manjar',     nombre: 'Lúcuma Manjar',       formato: '5L' },
  { id: 'p5-pina-agua',         nombre: 'Piña al Agua',        formato: '5L' },
  { id: 'p5-pistacho',          nombre: 'Pistacho',            formato: '5L' },
  { id: 'p5-vainilla',          nombre: 'Vainilla',            formato: '5L' },

  // ---- Helados 10 Litros (según temporada y stock) ----
  { id: 'p10-chocolate',        nombre: 'Chocolate',           formato: '10L' },
  { id: 'p10-frutilla',         nombre: 'Frutilla',            formato: '10L' },
  { id: 'p10-vainilla',         nombre: 'Vainilla',            formato: '10L' },
  { id: 'p10-lucuma',           nombre: 'Lúcuma',              formato: '10L' },
  { id: 'p10-frambuesa',        nombre: 'Frambuesa',           formato: '10L' },
  { id: 'p10-chirimoya-alegre', nombre: 'Chirimoya Alegre',    formato: '10L' },
  { id: 'p10-manjar',           nombre: 'Manjar',              formato: '10L' },
];

// --------- Datos de prueba (seed) ---------

const SEED_BATCHES = [
  { producto_id: 'p5-chocolate-clasico', cantidad: 40, fecha: '2026-05-20', notas: 'Producción semanal' },
  { producto_id: 'p5-vainilla',          cantidad: 35, fecha: '2026-05-20', notas: '' },
  { producto_id: 'p5-frutos-bosque',     cantidad: 25, fecha: '2026-05-22', notas: '' },
  { producto_id: 'p5-lucuma-manjar',     cantidad: 30, fecha: '2026-05-25', notas: '' },
  { producto_id: 'p5-pistacho',          cantidad: 15, fecha: '2026-05-28', notas: 'Lote chico, prueba' },
  { producto_id: 'p10-chocolate',        cantidad: 18, fecha: '2026-05-22', notas: '' },
  { producto_id: 'p10-frutilla',         cantidad: 20, fecha: '2026-05-22', notas: '' },
  { producto_id: 'p10-manjar',           cantidad: 12, fecha: '2026-06-01', notas: '' },
  { producto_id: 'p5-frambuesa',         cantidad: 22, fecha: '2026-06-03', notas: '' },
  { producto_id: 'p5-banana-split',      cantidad: 18, fecha: '2026-06-05', notas: '' },
  { producto_id: 'p10-vainilla',         cantidad: 14, fecha: '2026-06-05', notas: '' },
  { producto_id: 'p5-arroz-leche',       cantidad: 10, fecha: '2026-06-08', notas: '' },
];

const SEED_VENTAS = [
  { producto_id: 'p5-chocolate-clasico', cantidad: 12, fecha: '2026-05-23', canal: 'distribuidor', notas: '' },
  { producto_id: 'p5-vainilla',          cantidad: 10, fecha: '2026-05-24', canal: 'presencial',   notas: '' },
  { producto_id: 'p10-chocolate',        cantidad: 8,  fecha: '2026-05-26', canal: 'distribuidor', notas: '' },
  { producto_id: 'p5-frutos-bosque',     cantidad: 20, fecha: '2026-05-27', canal: 'presencial',   notas: 'Pedido grande' },
  { producto_id: 'p10-frutilla',         cantidad: 15, fecha: '2026-05-29', canal: 'distribuidor', notas: '' },
  { producto_id: 'p5-lucuma-manjar',     cantidad: 8,  fecha: '2026-06-02', canal: 'presencial',   notas: '' },
  { producto_id: 'p5-pistacho',          cantidad: 14, fecha: '2026-06-04', canal: 'presencial',   notas: '' },
  { producto_id: 'p5-frambuesa',         cantidad: 5,  fecha: '2026-06-06', canal: 'distribuidor', notas: '' },
  { producto_id: 'p10-manjar',           cantidad: 3,  fecha: '2026-06-07', canal: 'presencial',   notas: '' },
  { producto_id: 'p5-banana-split',      cantidad: 6,  fecha: '2026-06-09', canal: 'presencial',   notas: '' },
];

// --------- Persistencia (localStorage como BD simulada) ---------

const KEY_BATCHES = 'mepiache_batches';
const KEY_VENTAS = 'mepiache_ventas';

function _inicializarDatos() {
  if (!localStorage.getItem(KEY_BATCHES)) {
    localStorage.setItem(KEY_BATCHES, JSON.stringify(SEED_BATCHES));
  }
  if (!localStorage.getItem(KEY_VENTAS)) {
    localStorage.setItem(KEY_VENTAS, JSON.stringify(SEED_VENTAS));
  }
}
_inicializarDatos();

function getProductos() {
  return PRODUCTOS;
}

function getProductoPorId(id) {
  return PRODUCTOS.find(p => p.id === id);
}

function getBatches() {
  return JSON.parse(localStorage.getItem(KEY_BATCHES) || '[]');
}

function addBatch(batch) {
  const batches = getBatches();
  batches.push(batch);
  localStorage.setItem(KEY_BATCHES, JSON.stringify(batches));
}

function getVentas() {
  return JSON.parse(localStorage.getItem(KEY_VENTAS) || '[]');
}

function addVenta(venta) {
  const ventas = getVentas();
  ventas.push(venta);
  localStorage.setItem(KEY_VENTAS, JSON.stringify(ventas));
}

// --------- Cálculo de stock ---------
// stock = total producido - total vendido, por producto

function calcularStock() {
  const batches = getBatches();
  const ventas = getVentas();

  return PRODUCTOS.map(producto => {
    const totalProducido = batches
      .filter(b => b.producto_id === producto.id)
      .reduce((sum, b) => sum + Number(b.cantidad), 0);

    const totalVendido = ventas
      .filter(v => v.producto_id === producto.id)
      .reduce((sum, v) => sum + Number(v.cantidad), 0);

    return {
      ...producto,
      producido: totalProducido,
      vendido: totalVendido,
      stock: totalProducido - totalVendido,
    };
  });
}

// --------- Reset de datos de prueba (botón opcional) ---------

function resetDatosDemo() {
  localStorage.setItem(KEY_BATCHES, JSON.stringify(SEED_BATCHES));
  localStorage.setItem(KEY_VENTAS, JSON.stringify(SEED_VENTAS));
}
