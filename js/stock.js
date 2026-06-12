/* ===========================
   Mepiache Inventario - Stock actual
   =========================== */

let _stockEsAdmin = false;

// Grupos de categorías que se pueden filtrar desde los accesos rápidos de Inicio
// (no corresponden a una sola categoría/formato del selector).
const GRUPOS_CATEGORIA = {
  paletas: ['Paletas', 'Mis Paletas'],
  gelato: ['Gelato Premium Bachas', 'Gelato Premium Caja 6x750ml'],
};

let _grupoActivo = null;

const FILTROS_STOCK = ['filtro-categoria', 'filtro-sabor', 'filtro-estado'];

const _stockSort = initTableSort('#tabla-stock thead', [
  { tipo: 'texto', accesor: p => p.codigo },
  { tipo: 'texto', accesor: p => p.nombre },
  { tipo: 'texto', accesor: p => p.categoriaFormato },
  { tipo: 'numero', accesor: p => p.stock },
  { tipo: 'numero', accesor: p => p.stockMinimo },
  { tipo: 'texto', accesor: p => etiquetaEstadoStock(estadoStock(p)) },
  { tipo: 'texto', accesor: p => p.actualizado },
  null,
], () => renderTablaStock());

(async () => {
  const session = await initLayout('stock.html');
  if (!session) return;

  _stockEsAdmin = esAdmin();

  poblarFiltroCategoria();
  restaurarFiltrosDesdeStorage('stock', FILTROS_STOCK);
  aplicarFiltrosDesdeUrl();
  renderResumenCards();
  renderTablaStock();

  document.getElementById('filtro-categoria').addEventListener('change', () => {
    _grupoActivo = null;
    renderTablaStock();
  });
  document.getElementById('filtro-sabor').addEventListener('input', renderTablaStock);
  document.getElementById('filtro-estado').addEventListener('change', renderTablaStock);
  document.getElementById('btn-exportar-stock').addEventListener('click', exportarStockExcel);
  bindGuardarFiltros('stock', FILTROS_STOCK);
})();

function aplicarFiltrosDesdeUrl() {
  const params = new URLSearchParams(window.location.search);

  const categoria = params.get('categoria');
  if (categoria) document.getElementById('filtro-categoria').value = categoria;

  const estado = params.get('estado');
  if (estado) document.getElementById('filtro-estado').value = estado;

  const grupo = params.get('grupo');
  if (grupo && GRUPOS_CATEGORIA[grupo]) _grupoActivo = grupo;

  const busqueda = params.get('busqueda');
  if (busqueda) document.getElementById('filtro-sabor').value = busqueda;
}

function limpiarFiltrosStock() {
  document.getElementById('filtro-categoria').value = '';
  document.getElementById('filtro-sabor').value = '';
  document.getElementById('filtro-estado').value = '';
  _grupoActivo = null;
  guardarFiltrosEnStorage('stock', FILTROS_STOCK);
  renderTablaStock();
}

function poblarFiltroCategoria() {
  const sel = document.getElementById('filtro-categoria');
  sel.innerHTML += getCategorias().map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderResumenCards() {
  const { totalPorCategoria, bajoStock, sinStock } = getResumenStock();
  const totalPaletas = (totalPorCategoria['Paletas'] || 0) + (totalPorCategoria['Mis Paletas'] || 0);
  const totalGelato = (totalPorCategoria['Gelato Premium Bachas'] || 0) + (totalPorCategoria['Gelato Premium Caja 6x750ml'] || 0);

  const cards = [
    { label: 'Bote 10 L', valor: totalPorCategoria['Bote 10 L'] || 0 },
    { label: 'Bacha 5 L', valor: totalPorCategoria['Bacha 5 L'] || 0 },
    { label: 'Paletas (todas)', valor: totalPaletas },
    { label: 'Gelato Premium', valor: totalGelato },
    { label: 'Productos con stock bajo', valor: bajoStock, alerta: bajoStock > 0 },
    { label: 'Productos sin stock', valor: sinStock, alerta: sinStock > 0 },
  ];

  document.getElementById('resumen-cards').innerHTML = cards.map(c => `
    <div class="card ${c.alerta ? 'alerta' : ''}">
      <div class="card-label">${c.label}</div>
      <div class="card-valor">${c.valor}</div>
    </div>
  `).join('');
}

function productosFiltrados() {
  const categoria = document.getElementById('filtro-categoria').value;
  const busqueda = document.getElementById('filtro-sabor').value.trim().toLowerCase();
  const estadoFiltro = document.getElementById('filtro-estado').value;

  return getProductos()
    .filter(p => !_grupoActivo || GRUPOS_CATEGORIA[_grupoActivo].includes(p.categoriaFormato))
    .filter(p => !categoria || p.categoriaFormato === categoria)
    .filter(p => !busqueda || p.nombre.toLowerCase().includes(busqueda) || (p.codigo || '').toLowerCase().includes(busqueda))
    .filter(p => !estadoFiltro || estadoStock(p) === estadoFiltro)
    .sort((a, b) => a.categoriaFormato.localeCompare(b.categoriaFormato) || (a.orden || 0) - (b.orden || 0));
}

function renderTablaStock() {
  const tbody = document.getElementById('tabla-stock-body');

  const productos = _stockSort.ordenar(productosFiltrados());

  if (productos.length === 0) {
    tbody.innerHTML = htmlEstadoVacioFiltros(8, 'No se encontraron productos con ese filtro.', 'limpiarFiltrosStock');
    return;
  }

  tbody.innerHTML = productos.map(p => {
    const estado = estadoStock(p);
    const badgeClass = estado === 'sin_stock' ? 'sin' : estado === 'bajo' ? 'bajo' : 'ok';

    const acciones = [
      `<a class="btn" href="produccion.html?producto=${p.id}">+ Producción</a>`,
      `<a class="btn secundario" href="venta.html?producto=${p.id}">Venta/salida</a>`,
    ];
    if (_stockEsAdmin) {
      acciones.push(`<a class="btn secundario" href="merma.html?producto=${p.id}">Merma</a>`);
    }

    return `
      <tr>
        <td>${p.codigo || ''}</td>
        <td>${p.nombre}</td>
        <td>${p.categoriaFormato}</td>
        <td class="numero"><strong>${p.stock}</strong></td>
        <td class="numero">${p.stockMinimo}</td>
        <td><span class="badge ${badgeClass}">${etiquetaEstadoStock(estado)}</span></td>
        <td>${formatearFechaHora(p.actualizado)}</td>
        <td><div class="acciones-tabla">${acciones.join('')}</div></td>
      </tr>
    `;
  }).join('');
}

function exportarStockExcel() {
  const productos = productosFiltrados();

  const filas = productos.map(p => ({
    'Código': p.codigo || '',
    Sabor: p.nombre,
    'Categoría/Formato': p.categoriaFormato,
    'Stock actual': p.stock,
    'Stock mínimo': p.stockMinimo,
    Estado: etiquetaEstadoStock(estadoStock(p)),
    'Última actualización': formatearFechaHora(p.actualizado),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Stock actual');

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `mepiache-stock-${fecha}.xlsx`);
}
