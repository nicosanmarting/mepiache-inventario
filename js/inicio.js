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

  renderResumen();
  await Promise.all([
    renderUltimoConteo(),
    renderUltimosMovimientos(),
  ]);
})();

function renderResumen() {
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
      <td>${formatearFecha(m.fecha)}</td>
      <td>${m.producto ? m.producto.nombre : m.producto_id}</td>
      <td>${etiquetaTipoMovimiento(m.tipo_movimiento)}</td>
      <td class="numero">${m.cantidad}</td>
      <td>${m.motivo || ''}</td>
    </tr>
  `).join('');
}
