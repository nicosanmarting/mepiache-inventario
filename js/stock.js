/* ===========================
   Mepiache Inventario - Stock actual
   =========================== */

let _stockEsAdmin = false;

(async () => {
  const session = await initLayout('stock.html');
  if (!session) return;

  _stockEsAdmin = esAdmin();

  poblarFiltroCategoria();
  renderResumenCards();
  renderTablaStock();

  document.getElementById('filtro-categoria').addEventListener('change', renderTablaStock);
  document.getElementById('filtro-sabor').addEventListener('input', renderTablaStock);
  document.getElementById('filtro-estado').addEventListener('change', renderTablaStock);
})();

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

function renderTablaStock() {
  const tbody = document.getElementById('tabla-stock-body');

  const categoria = document.getElementById('filtro-categoria').value;
  const busqueda = document.getElementById('filtro-sabor').value.trim().toLowerCase();
  const estadoFiltro = document.getElementById('filtro-estado').value;

  const productos = getProductos()
    .filter(p => !categoria || p.categoriaFormato === categoria)
    .filter(p => !busqueda || p.nombre.toLowerCase().includes(busqueda) || (p.codigo || '').toLowerCase().includes(busqueda))
    .filter(p => !estadoFiltro || estadoStock(p) === estadoFiltro)
    .sort((a, b) => a.categoriaFormato.localeCompare(b.categoriaFormato) || (a.orden || 0) - (b.orden || 0));

  if (productos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">No se encontraron productos con ese filtro.</td></tr>`;
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
