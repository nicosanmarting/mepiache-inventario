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

// --------- Métricas mensuales ---------

function _mesDeFecha(fechaStr) {
  return fechaStr ? fechaStr.slice(0, 7) : ''; // 'YYYY-MM'
}

function _sumarMeses(mesBase, n) {
  const [anio, mes] = mesBase.split('-').map(Number);
  const d = new Date(anio, mes - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Devuelve producción, ventas y stock agregados por mes para los últimos
// `numMeses` meses (incluyendo el actual), más comparación mes actual vs anterior.
async function getMetricasMensuales(numMeses = 6) {
  const [batches, ventas] = await Promise.all([getBatches(), getVentas()]);

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const meses = [];
  for (let i = numMeses - 1; i >= 0; i--) {
    meses.push(_sumarMeses(mesActual, -i));
  }

  const producidoPorMes = meses.map(mes =>
    batches.filter(b => _mesDeFecha(b.fecha) === mes)
      .reduce((s, b) => s + Number(b.cantidad), 0)
  );

  const vendidoPorMes = meses.map(mes =>
    ventas.filter(v => _mesDeFecha(v.fecha) === mes)
      .reduce((s, v) => s + Number(v.cantidad), 0)
  );

  // Stock acumulado al cierre de cada mes (considera todo el historial)
  const stockAcumuladoPorMes = meses.map(mes => {
    const producidoHasta = batches.filter(b => _mesDeFecha(b.fecha) <= mes)
      .reduce((s, b) => s + Number(b.cantidad), 0);
    const vendidoHasta = ventas.filter(v => _mesDeFecha(v.fecha) <= mes)
      .reduce((s, v) => s + Number(v.cantidad), 0);
    return producidoHasta - vendidoHasta;
  });

  const mesAnterior = _sumarMeses(mesActual, -1);
  const idxActual = meses.indexOf(mesActual);
  const idxAnterior = meses.indexOf(mesAnterior);

  return {
    meses,
    producidoPorMes,
    vendidoPorMes,
    stockAcumuladoPorMes,
    producidoMesActual: idxActual >= 0 ? producidoPorMes[idxActual] : 0,
    vendidoMesActual: idxActual >= 0 ? vendidoPorMes[idxActual] : 0,
    producidoMesAnterior: idxAnterior >= 0 ? producidoPorMes[idxAnterior] : 0,
    vendidoMesAnterior: idxAnterior >= 0 ? vendidoPorMes[idxAnterior] : 0,
    stockTotal: stockAcumuladoPorMes[stockAcumuladoPorMes.length - 1],
  };
}
