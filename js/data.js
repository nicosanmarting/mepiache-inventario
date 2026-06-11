/* ===========================
   Mepiache Inventario - Datos (Supabase)
   ---------------------------------------------
   Acceso a las tablas productos, batches y ventas
   definidas en sql/schema.sql.

   Notas de mapeo:
   - En la tabla "productos", la columna "sabor" tiene
     el nombre del sabor (ej: "Arroz con Leche") y
     "nombre" es genérico ("Helado 5L" / "Helado 10L").
     Para que el resto del frontend sea simple, acá se
     expone cada producto como { id, nombre, formato }
     donde "nombre" = sabor.
   =========================== */

let _productosCache = null;

async function cargarProductos() {
  const { data, error } = await supabaseClient
    .from('productos')
    .select('id, sabor, formato')
    .eq('activo', true)
    .order('formato', { ascending: true })
    .order('sabor', { ascending: true });

  if (error) {
    console.error('Error cargando productos:', error);
    _productosCache = [];
    return _productosCache;
  }

  _productosCache = data.map(p => ({
    id: p.id,
    nombre: p.sabor,
    formato: p.formato,
  }));

  return _productosCache;
}

function getProductos() {
  return _productosCache || [];
}

function getProductoPorId(id) {
  return (_productosCache || []).find(p => p.id === id);
}

// --------- Producción (batches) ---------

async function getBatches() {
  const { data, error } = await supabaseClient
    .from('batches')
    .select('id, producto_id, cantidad, fecha, notas')
    .order('fecha', { ascending: false });

  if (error) {
    console.error('Error cargando batches:', error);
    return [];
  }
  return data;
}

async function addBatch(batch) {
  const { data: { user } } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient.from('batches').insert({
    producto_id: batch.producto_id,
    cantidad: batch.cantidad,
    fecha: batch.fecha,
    notas: batch.notas || null,
    usuario_id: user ? user.id : null,
  });

  if (error) {
    console.error('Error guardando producción:', error);
    throw error;
  }
}

// --------- Ventas ---------

async function getVentas() {
  const { data, error } = await supabaseClient
    .from('ventas')
    .select('id, producto_id, cantidad, fecha, canal, notas')
    .order('fecha', { ascending: false });

  if (error) {
    console.error('Error cargando ventas:', error);
    return [];
  }
  return data;
}

async function addVenta(venta) {
  const { data: { user } } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient.from('ventas').insert({
    producto_id: venta.producto_id,
    cantidad: venta.cantidad,
    fecha: venta.fecha,
    canal: venta.canal,
    notas: venta.notas || null,
    usuario_id: user ? user.id : null,
  });

  if (error) {
    console.error('Error guardando venta:', error);
    throw error;
  }
}

// --------- Cálculo de stock ---------
// stock = total producido - total vendido, por producto

async function calcularStock() {
  const [batches, ventas] = await Promise.all([getBatches(), getVentas()]);
  const productos = getProductos();

  return productos.map(producto => {
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
