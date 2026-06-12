/* ===========================
   Mepiache Inventario - Inicio
   =========================== */

(async () => {
  const session = await initLayout('inicio.html');
  if (!session) return;

  if (!esAdmin()) {
    const btnMerma = document.getElementById('btn-merma');
    const btnMetricas = document.getElementById('btn-metricas');
    if (btnMerma) btnMerma.remove();
    if (btnMetricas) btnMetricas.remove();
  }

  await renderResumen();
  await Promise.all([
    renderAlertasCriticas(),
    renderUltimoConteo(),
    renderUltimosMovimientos(),
  ]);

  bindBuscadorGlobal();

  if (new URLSearchParams(window.location.search).get('foco') === 'buscador') {
    const input = document.getElementById('buscador-global');
    if (input) input.focus();
  }
})();

// --------- Buscador global ---------

function _normalizarTexto(texto) {
  return (texto ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function bindBuscadorGlobal() {
  const input = document.getElementById('buscador-global');
  const resultados = document.getElementById('buscador-global-resultados');
  if (!input || !resultados) return;

  input.addEventListener('input', () => {
    const termino = input.value.trim();
    const q = _normalizarTexto(termino);

    if (q.length < 2) {
      resultados.innerHTML = '';
      resultados.style.display = 'none';
      return;
    }

    const productos = getProductos()
      .filter(p => _normalizarTexto(p.nombre).includes(q) || _normalizarTexto(p.codigo).includes(q))
      .slice(0, 6)
      .map(p => ({
        tipo: 'Producto',
        nombre: p.nombre,
        extra: p.categoriaFormato,
        href: `stock.html?busqueda=${encodeURIComponent(p.nombre)}`,
      }));

    const materias = getMateriasPrimas()
      .filter(mp => _normalizarTexto(mp.nombre).includes(q) || _normalizarTexto(mp.codigo).includes(q))
      .slice(0, 6)
      .map(mp => ({
        tipo: 'Materia prima',
        nombre: mp.nombre,
        extra: mp.categoria,
        href: `materias-primas.html?busqueda=${encodeURIComponent(mp.nombre)}`,
      }));

    const items = [...productos, ...materias].slice(0, 10);

    if (items.length === 0) {
      resultados.innerHTML = `<div class="buscador-global-vacio">Sin resultados para "${esc(termino)}".</div>`;
    } else {
      resultados.innerHTML = items.map(it => `
        <a class="buscador-global-item" href="${it.href}">
          <span>${esc(it.nombre)}</span>
          <span class="buscador-global-tipo">${it.tipo} · ${esc(it.extra)}</span>
        </a>
      `).join('');
    }

    resultados.style.display = 'block';
  });

  input.addEventListener('focus', () => {
    if (resultados.innerHTML.trim()) resultados.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (e.target !== input && !resultados.contains(e.target)) {
      resultados.style.display = 'none';
    }
  });
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Tabla de productos y materias primas bajo stock mínimo o sin stock,
// ordenados por urgencia (sin stock primero).
async function renderAlertasCriticas() {
  const tbody = document.getElementById('tabla-alertas-body');
  if (!tbody) return;

  const productos = getProductos()
    .filter(p => estadoStock(p) !== 'ok')
    .map(p => ({
      tipo: 'Producto',
      nombre: p.nombre,
      categoria: p.categoriaFormato,
      stock: p.stock,
      stockMinimo: p.stockMinimo,
      unidad: p.unidadConteo || '',
      estado: estadoStock(p),
    }));

  const materias = getMateriasPrimas()
    .filter(mp => mp.activo && estadoStockMP(mp) !== 'ok')
    .map(mp => ({
      tipo: 'Materia prima',
      nombre: mp.nombre,
      categoria: mp.categoria,
      stock: mp.stock,
      stockMinimo: mp.stockMinimo,
      unidad: mp.unidadMedida || '',
      estado: estadoStockMP(mp),
    }));

  const orden = { sin_stock: 0, bajo: 1 };
  const items = [...productos, ...materias].sort((a, b) => orden[a.estado] - orden[b.estado]);

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">Sin alertas: todo el stock está dentro de lo normal. ✔</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(it => {
    const badgeClass = it.estado === 'sin_stock' ? 'sin' : 'bajo';
    return `
      <tr>
        <td data-label="Tipo">${it.tipo}</td>
        <td data-label="Nombre">${it.nombre}</td>
        <td data-label="Categoría">${it.categoria}</td>
        <td class="numero" data-label="Stock actual">${it.stock} ${it.unidad}</td>
        <td class="numero" data-label="Stock mínimo">${it.stockMinimo} ${it.unidad}</td>
        <td data-label="Estado"><span class="badge ${badgeClass}">${etiquetaEstadoStock(it.estado)}</span></td>
      </tr>
    `;
  }).join('');
}

async function renderResumen() {
  const { totalPorCategoria, bajoStock, sinStock } = getResumenStock();

  const totalPaletas = (totalPorCategoria['Paletas'] || 0) + (totalPorCategoria['Mis Paletas'] || 0);
  const totalGelato = (totalPorCategoria['Gelato Premium Bachas'] || 0) + (totalPorCategoria['Gelato Premium Caja 6x750ml'] || 0);

  const cards = [
    { label: 'Bote 10 L', valor: totalPorCategoria['Bote 10 L'] || 0, href: 'stock.html?categoria=' + encodeURIComponent('Bote 10 L') },
    { label: 'Bacha 5 L', valor: totalPorCategoria['Bacha 5 L'] || 0, href: 'stock.html?categoria=' + encodeURIComponent('Bacha 5 L') },
    { label: 'Paletas (todas)', valor: totalPaletas, href: 'stock.html?grupo=paletas' },
    { label: 'Gelato Premium', valor: totalGelato, href: 'stock.html?grupo=gelato' },
    { label: 'Sustancias', valor: totalPorCategoria['Sustancias'] || 0, href: 'stock.html?categoria=' + encodeURIComponent('Sustancias') },
    { label: 'Productos con stock bajo', valor: bajoStock, alerta: bajoStock > 0, href: 'stock.html?estado=bajo' },
    { label: 'Productos sin stock', valor: sinStock, alerta: sinStock > 0, href: 'stock.html?estado=sin_stock' },
  ];

  if (esAdmin()) {
    const { vencidos } = await getResumenMantenciones();
    cards.push({ label: 'Mantenciones vencidas', valor: vencidos, alerta: vencidos > 0, href: 'equipos.html' });
  }

  document.getElementById('resumen-cards').innerHTML = cards.map(c => `
    <a class="card ${c.alerta ? 'alerta' : ''}" href="${c.href}">
      <div class="card-label">${c.label}</div>
      <div class="card-valor">${c.valor}</div>
    </a>
  `).join('');
}

async function renderUltimoConteo() {
  const cont = document.getElementById('ultimo-conteo');
  const conteo = await getUltimoConteo();

  if (!conteo) {
    cont.innerHTML = `<div class="estado-vacio">Aún no se ha realizado ningún conteo.</div>`;
    return;
  }

  const estadoBadge = conteo.estado === 'finalizado'
    ? '<span class="badge ok">Finalizado</span>'
    : '<span class="badge bajo">Borrador</span>';

  const fecha = conteo.estado === 'finalizado' && conteo.finalized_at
    ? formatearFechaHora(conteo.finalized_at)
    : formatearFechaHora(conteo.created_at);

  cont.innerHTML = `
    <div class="card" style="max-width: 320px;">
      <div class="card-label">${conteo.categoria_formato}</div>
      <div class="card-valor" style="font-size: 18px;">${fecha}</div>
      <div style="margin-top: 8px;">${estadoBadge}</div>
      ${conteo.estado !== 'finalizado' ? `<div style="margin-top: 10px;"><a class="btn" href="conteo.html?id=${conteo.id}">Continuar conteo</a></div>` : ''}
    </div>
  `;
}

async function renderUltimosMovimientos() {
  const tbody = document.getElementById('tabla-movimientos-body');
  const movimientos = await getMovimientos({ limite: 10 });

  if (movimientos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Aún no hay movimientos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = movimientos.map(m => `
    <tr>
      <td data-label="Fecha">${formatearFecha(m.fecha)}</td>
      <td data-label="Producto">${m.producto ? m.producto.nombre : m.producto_id}</td>
      <td data-label="Tipo">${etiquetaTipoMovimiento(m.tipo_movimiento)}</td>
      <td class="numero" data-label="Cantidad">${m.cantidad}</td>
      <td data-label="Motivo">${m.motivo || ''}</td>
    </tr>
  `).join('');
}
