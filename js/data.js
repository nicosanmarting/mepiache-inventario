/* ===========================
   Mepiache Inventario - Datos (Supabase) v2
   ---------------------------------------------
   Acceso a productos (con stock_actual ya calculado),
   movimientos_inventario, conteos y conteo_detalle.
   Ver sql/migration_v2_inventario.sql para el esquema.
   =========================== */

// Categorías/formato válidas, en el orden en que deben mostrarse.
const CATEGORIAS_FORMATO = [
  'Bote 10 L',
  'Bacha 5 L',
  'Paletas',
  'Mis Paletas',
  'Gelato Premium Bachas',
  'Gelato Premium Caja 6x750ml',
];

// Motivos sugeridos por tipo de movimiento.
const MOTIVOS_VENTA_SALIDA = ['Venta', 'Despacho', 'Distribuidor', 'Uso interno', 'Degustación', 'Otro'];
const MOTIVOS_MERMA = ['Producto dañado', 'Descongelamiento', 'Envase roto', 'Error de producción', 'Vencimiento', 'Diferencia física', 'Otro'];

let _productosCache = null;

async function cargarProductos() {
  const { data, error } = await supabaseClient
    .from('productos')
    .select('id, sabor, codigo, categoria_formato, linea, unidad_conteo, contenido, unidad_contenido, stock_actual, stock_minimo, orden, updated_at')
    .eq('activo', true)
    .order('categoria_formato', { ascending: true })
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error cargando productos:', error);
    _productosCache = [];
    return _productosCache;
  }

  _productosCache = data.map(p => ({
    id: p.id,
    nombre: p.sabor,
    codigo: p.codigo,
    categoriaFormato: p.categoria_formato,
    linea: p.linea,
    unidadConteo: p.unidad_conteo,
    contenido: p.contenido,
    unidadContenido: p.unidad_contenido,
    stock: Number(p.stock_actual) || 0,
    stockMinimo: Number(p.stock_minimo) || 0,
    orden: p.orden,
    actualizado: p.updated_at,
  }));

  return _productosCache;
}

function getProductos() {
  return _productosCache || [];
}

function getProductoPorId(id) {
  return (_productosCache || []).find(p => p.id === id);
}

function getProductosPorCategoria(categoriaFormato) {
  return getProductos()
    .filter(p => p.categoriaFormato === categoriaFormato)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function getCategorias() {
  return CATEGORIAS_FORMATO;
}

// --------- Encargados de conteo ---------

let _encargadosCache = null;

async function cargarEncargados() {
  const { data, error } = await supabaseClient
    .from('encargados')
    .select('id, nombre, activo, orden')
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error cargando encargados:', error);
    _encargadosCache = [];
    return _encargadosCache;
  }

  _encargadosCache = data;
  return _encargadosCache;
}

// Encargados activos, para el selector de conteo.
function getEncargados() {
  return (_encargadosCache || []).filter(e => e.activo);
}

// Todos los encargados (activos e inactivos), para Configuración.
function getEncargadosTodos() {
  return _encargadosCache || [];
}

async function crearEncargado(nombre) {
  const { data, error } = await supabaseClient
    .from('encargados')
    .insert({ nombre, activo: true })
    .select()
    .single();

  if (error) {
    console.error('Error creando encargado:', error);
    throw error;
  }
  return data;
}

async function actualizarEncargado(id, campos) {
  const payload = {};

  if ('nombre' in campos) payload.nombre = campos.nombre;
  if ('activo' in campos) payload.activo = !!campos.activo;
  if ('orden' in campos) payload.orden = (campos.orden === '' || campos.orden === null) ? null : Number(campos.orden);

  const { error } = await supabaseClient
    .from('encargados')
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error('Error actualizando encargado:', error);
    throw error;
  }
}

// --------- Configuración / productos (admin) ---------

// Trae TODOS los productos (activos e inactivos), sin pasar por la caché.
// Usado en la pantalla de Configuración.
async function getProductosTodos() {
  const { data, error } = await supabaseClient
    .from('productos')
    .select('id, sabor, codigo, categoria_formato, linea, unidad_conteo, contenido, unidad_contenido, stock_actual, stock_minimo, orden, activo, updated_at')
    .order('categoria_formato', { ascending: true })
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error cargando productos (configuración):', error);
    return [];
  }

  return data.map(p => ({
    id: p.id,
    nombre: p.sabor,
    codigo: p.codigo,
    categoriaFormato: p.categoria_formato,
    linea: p.linea,
    unidadConteo: p.unidad_conteo,
    contenido: p.contenido,
    unidadContenido: p.unidad_contenido,
    stock: Number(p.stock_actual) || 0,
    stockMinimo: Number(p.stock_minimo) || 0,
    orden: p.orden,
    activo: p.activo,
    actualizado: p.updated_at,
  }));
}

// Actualiza los datos de catálogo de un producto (no toca stock_actual).
async function actualizarProducto(id, campos) {
  const payload = { updated_at: new Date().toISOString() };

  if ('codigo' in campos) payload.codigo = campos.codigo || null;
  if ('nombre' in campos) {
    payload.sabor = campos.nombre;
    payload.nombre = campos.nombre;
  }
  if ('categoriaFormato' in campos) payload.categoria_formato = campos.categoriaFormato;
  if ('linea' in campos) payload.linea = campos.linea || null;
  if ('unidadConteo' in campos) payload.unidad_conteo = campos.unidadConteo || null;
  if ('contenido' in campos) payload.contenido = (campos.contenido === '' || campos.contenido === null) ? null : Number(campos.contenido);
  if ('unidadContenido' in campos) payload.unidad_contenido = campos.unidadContenido || null;
  if ('stockMinimo' in campos) payload.stock_minimo = Number(campos.stockMinimo) || 0;
  if ('orden' in campos) payload.orden = (campos.orden === '' || campos.orden === null) ? null : Number(campos.orden);
  if ('activo' in campos) payload.activo = !!campos.activo;

  const { error } = await supabaseClient
    .from('productos')
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error('Error actualizando producto:', error);
    throw error;
  }
}

// Crea un producto nuevo en el catálogo.
async function crearProducto(datos) {
  const payload = {
    nombre: datos.nombre,
    sabor: datos.nombre,
    codigo: datos.codigo || null,
    categoria_formato: datos.categoriaFormato,
    linea: datos.linea || null,
    unidad_conteo: datos.unidadConteo || 'unidades',
    contenido: (datos.contenido === '' || datos.contenido === undefined) ? null : Number(datos.contenido),
    unidad_contenido: datos.unidadContenido || null,
    stock_actual: Number(datos.stockActual) || 0,
    stock_minimo: Number(datos.stockMinimo) || 0,
    orden: (datos.orden === '' || datos.orden === undefined) ? null : Number(datos.orden),
    activo: true,
  };

  const { data, error } = await supabaseClient
    .from('productos')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Error creando producto:', error);
    throw error;
  }

  return data;
}

// 'sin_stock' | 'bajo' | 'ok'
function estadoStock(p) {
  if (p.stock <= 0) return 'sin_stock';
  if (p.stock < p.stockMinimo) return 'bajo';
  return 'ok';
}

function etiquetaEstadoStock(estado) {
  if (estado === 'sin_stock') return 'Sin stock';
  if (estado === 'bajo') return 'Stock bajo';
  return 'OK';
}

// --------- Resúmenes (Inicio / Stock) ---------

function getResumenStock() {
  const productos = getProductos();

  const totalPorCategoria = {};
  CATEGORIAS_FORMATO.forEach(c => { totalPorCategoria[c] = 0; });

  let bajoStock = 0;
  let sinStock = 0;

  productos.forEach(p => {
    if (totalPorCategoria[p.categoriaFormato] !== undefined) {
      totalPorCategoria[p.categoriaFormato] += p.stock;
    }
    const estado = estadoStock(p);
    if (estado === 'sin_stock') sinStock++;
    else if (estado === 'bajo') bajoStock++;
  });

  return { totalPorCategoria, bajoStock, sinStock };
}

// --------- Movimientos de inventario ---------

const TIPOS_MOVIMIENTO_LABEL = {
  conteo: 'Conteo',
  ajuste_por_conteo: 'Ajuste por conteo',
  produccion: 'Producción',
  venta_salida: 'Venta/salida',
  merma: 'Merma',
  ajuste_manual: 'Ajuste manual',
};

function etiquetaTipoMovimiento(tipo) {
  return TIPOS_MOVIMIENTO_LABEL[tipo] || tipo;
}

// Registra un movimiento vía RPC (atómico: actualiza stock_actual + inserta historial).
// tipoMovimiento: 'produccion' | 'venta_salida' | 'merma' | 'ajuste_manual'
async function registrarMovimiento({ productoId, tipoMovimiento, cantidad, motivo, nota, fecha, permitirNegativo }) {
  const { data, error } = await supabaseClient.rpc('registrar_movimiento', {
    p_producto_id: productoId,
    p_tipo_movimiento: tipoMovimiento,
    p_cantidad: cantidad,
    p_motivo: motivo || null,
    p_nota: nota || null,
    p_fecha: fecha || new Date().toISOString().slice(0, 10),
    p_permitir_negativo: !!permitirNegativo,
  });

  if (error) {
    console.error('Error registrando movimiento:', error);
    throw error;
  }

  const resultado = Array.isArray(data) ? data[0] : data;

  // Actualizar caché local para que la UI refleje el nuevo stock sin recargar.
  const producto = getProductoPorId(productoId);
  if (producto && resultado) {
    producto.stock = Number(resultado.stock_despues);
  }

  return resultado;
}

async function getMovimientos({ limite = 50, productoId = null, tipoMovimiento = null, categoriaFormato = null, desde = null, hasta = null } = {}) {
  let query = supabaseClient
    .from('movimientos_inventario')
    .select('id, producto_id, tipo_movimiento, cantidad, stock_antes, stock_despues, motivo, nota, usuario_id, fecha, created_at')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite);

  if (productoId) query = query.eq('producto_id', productoId);
  if (tipoMovimiento) query = query.eq('tipo_movimiento', tipoMovimiento);
  if (desde) query = query.gte('fecha', desde);
  if (hasta) query = query.lte('fecha', hasta);

  const { data, error } = await query;
  if (error) {
    console.error('Error cargando movimientos:', error);
    return [];
  }

  let movimientos = data.map(m => ({
    ...m,
    producto: getProductoPorId(m.producto_id) || null,
  }));

  if (categoriaFormato) {
    movimientos = movimientos.filter(m => m.producto && m.producto.categoriaFormato === categoriaFormato);
  }

  return movimientos;
}

// --------- Conteos ---------

async function crearConteo(categoriaFormato, observacion, encargado) {
  const { data, error } = await supabaseClient.rpc('crear_conteo', {
    p_categoria_formato: categoriaFormato,
    p_observacion: observacion || null,
    p_encargado: encargado || null,
  });
  if (error) {
    console.error('Error creando conteo:', error);
    throw error;
  }
  return data; // uuid del conteo
}

async function getConteoDetalle(conteoId) {
  const { data, error } = await supabaseClient
    .from('conteo_detalle')
    .select('id, conteo_id, producto_id, stock_sistema, stock_contado, diferencia, observacion')
    .eq('conteo_id', conteoId);

  if (error) {
    console.error('Error cargando detalle de conteo:', error);
    return [];
  }

  return data
    .map(d => ({ ...d, producto: getProductoPorId(d.producto_id) || null }))
    .sort((a, b) => {
      const oa = a.producto ? (a.producto.orden || 0) : 0;
      const ob = b.producto ? (b.producto.orden || 0) : 0;
      return oa - ob;
    });
}

async function guardarConteoDetalle(detalleId, { stockContado, observacion }) {
  const { error } = await supabaseClient
    .from('conteo_detalle')
    .update({
      stock_contado: (stockContado === null || stockContado === '' || stockContado === undefined) ? null : Number(stockContado),
      observacion: observacion || null,
    })
    .eq('id', detalleId);

  if (error) {
    console.error('Error guardando detalle de conteo:', error);
    throw error;
  }
}

async function finalizarConteo(conteoId) {
  const { error } = await supabaseClient.rpc('finalizar_conteo', { p_conteo_id: conteoId });
  if (error) {
    console.error('Error finalizando conteo:', error);
    throw error;
  }
  // El stock_actual de varios productos pudo cambiar por los ajustes.
  await cargarProductos();
}

async function getConteos({ limite = 20, categoriaFormato = null, estado = null } = {}) {
  let query = supabaseClient
    .from('conteos')
    .select('id, categoria_formato, usuario_id, estado, observacion, encargado, created_at, finalized_at')
    .order('created_at', { ascending: false })
    .limit(limite);

  if (categoriaFormato) query = query.eq('categoria_formato', categoriaFormato);
  if (estado) query = query.eq('estado', estado);

  const { data, error } = await query;
  if (error) {
    console.error('Error cargando conteos:', error);
    return [];
  }
  return data;
}

async function getUltimoConteo() {
  const conteos = await getConteos({ limite: 1 });
  return conteos[0] || null;
}

// Trae todos los detalles de conteo (de todos los conteos), con el producto resuelto.
// Usado para la exportación a Excel.
async function getTodoConteoDetalle() {
  const { data, error } = await supabaseClient
    .from('conteo_detalle')
    .select('id, conteo_id, producto_id, stock_sistema, stock_contado, diferencia, observacion');

  if (error) {
    console.error('Error cargando detalle de conteos:', error);
    return [];
  }

  return data.map(d => ({ ...d, producto: getProductoPorId(d.producto_id) || null }));
}

async function getConteoPorId(conteoId) {
  const { data, error } = await supabaseClient
    .from('conteos')
    .select('id, categoria_formato, usuario_id, estado, observacion, encargado, created_at, finalized_at')
    .eq('id', conteoId)
    .single();

  if (error) {
    console.error('Error cargando conteo:', error);
    return null;
  }
  return data;
}

// --------- Métricas mensuales (basadas en movimientos_inventario) ---------

const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatearMes(mesStr) {
  const [anio, mes] = mesStr.split('-').map(Number);
  return `${NOMBRES_MES[mes - 1]} ${anio}`;
}

function _mesDeFecha(fechaStr) {
  return fechaStr ? fechaStr.slice(0, 7) : '';
}

function _sumarMeses(mesBase, n) {
  const [anio, mes] = mesBase.split('-').map(Number);
  const d = new Date(anio, mes - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Trae todos los movimientos de los últimos `numMeses` meses (paginando si hace falta).
async function _getMovimientosDesde(fechaDesde) {
  const { data, error } = await supabaseClient
    .from('movimientos_inventario')
    .select('id, producto_id, tipo_movimiento, cantidad, motivo, fecha')
    .gte('fecha', fechaDesde)
    .order('fecha', { ascending: true });

  if (error) {
    console.error('Error cargando movimientos para métricas:', error);
    return [];
  }
  return data;
}

async function getMetricasMensuales(numMeses = 6) {
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const meses = [];
  for (let i = numMeses - 1; i >= 0; i--) {
    meses.push(_sumarMeses(mesActual, -i));
  }

  const fechaDesde = `${meses[0]}-01`;
  const movimientos = await _getMovimientosDesde(fechaDesde);

  const producidoPorMes = meses.map(mes =>
    movimientos.filter(m => m.tipo_movimiento === 'produccion' && _mesDeFecha(m.fecha) === mes)
      .reduce((s, m) => s + Number(m.cantidad), 0)
  );

  const vendidoPorMes = meses.map(mes =>
    movimientos.filter(m => m.tipo_movimiento === 'venta_salida' && _mesDeFecha(m.fecha) === mes)
      .reduce((s, m) => s + Number(m.cantidad), 0)
  );

  const mermaPorMes = meses.map(mes =>
    movimientos.filter(m => m.tipo_movimiento === 'merma' && _mesDeFecha(m.fecha) === mes)
      .reduce((s, m) => s + Number(m.cantidad), 0)
  );

  const resumen = getResumenStock();
  const stockTotal = Object.values(resumen.totalPorCategoria).reduce((s, v) => s + v, 0);

  const mesAnterior = _sumarMeses(mesActual, -1);
  const idxActual = meses.indexOf(mesActual);
  const idxAnterior = meses.indexOf(mesAnterior);

  return {
    meses,
    producidoPorMes,
    vendidoPorMes,
    mermaPorMes,
    movimientos,
    producidoMesActual: idxActual >= 0 ? producidoPorMes[idxActual] : 0,
    vendidoMesActual: idxActual >= 0 ? vendidoPorMes[idxActual] : 0,
    mermaMesActual: idxActual >= 0 ? mermaPorMes[idxActual] : 0,
    producidoMesAnterior: idxAnterior >= 0 ? producidoPorMes[idxAnterior] : 0,
    vendidoMesAnterior: idxAnterior >= 0 ? vendidoPorMes[idxAnterior] : 0,
    stockTotal,
  };
}
